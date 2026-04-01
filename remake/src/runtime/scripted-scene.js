import { renderTalkDialog, renderTalkResponse } from '../ui/dialog-renderer.js';
import { renderTextForm } from '../ui/form-renderer.js';
import { renderInventoryScreen } from '../ui/inventory-renderer.js';
import { renderNotePopup } from '../ui/note-renderer.js';
import { renderResourcePopup } from '../ui/resource-renderer.js';

export class ScriptedScene {
  constructor({ sceneScript, dialogLayout, noteLayout, dialogResponseDelayTicks = 0 } = {}) {
    this.engine = null;
    this.sceneScript = sceneScript || {};
    this.dialogLayout = dialogLayout || null;
    this.noteLayout = noteLayout || null;
    this.dialogResponseDelayTicks = dialogResponseDelayTicks;
    this.actionQueue = [];
    this.modal = null;
    this.state = {};
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    this._inventoryItemBoxes = [];
    this._inventoryControlBoxes = [];
    this._interactionEnabled = {};
    this.currentSound = null;
    this._gestureLockedDialog = null;
    this._pendingDialogChoiceEvent = null;
    this._pendingDialogDelayTicks = 0;
    this.onTransition = null;
  }

  attach(engine) {
    this.engine = engine;
  }

  initScriptRuntime() {
    this.actionQueue = [];
    this.modal = null;
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    this._inventoryItemBoxes = [];
    this._inventoryControlBoxes = [];
    this.currentSound = null;
    this._gestureLockedDialog = null;
    this._pendingDialogChoiceEvent = null;
    this._pendingDialogDelayTicks = 0;
    this.state = { ...(this.sceneScript.initialState || {}) };
    this._interactionEnabled = {};

    for (const interaction of this.sceneScript.interactions || []) {
      this._interactionEnabled[interaction.id] = interaction.enabled !== false;
    }
    this._applyBindings();
  }

  tickScriptRuntime() {
    if (this.modal?.type === 'dialog' && this.modal.phase === 'alexReply' && this.modal.alexTalking) {
      this.modal.replyTick = Math.min(this.modal.replyDurationTicks || 0, (this.modal.replyTick || 0) + 1);
    }
    if (this._pendingDialogDelayTicks > 0) {
      this._pendingDialogDelayTicks--;
      if (this._pendingDialogDelayTicks === 0 && this._pendingDialogChoiceEvent) {
        if (this.modal?.type === 'dialog') {
          this.modal = null;
          this._afterModalChanged?.();
        }
        const pending = this._pendingDialogChoiceEvent;
        this._pendingDialogChoiceEvent = null;
        this._choiceBoxes = [];
        this._dialogExitBox = null;
        this._inventoryItemBoxes = [];
        this._inventoryControlBoxes = [];
        this._refreshCursor?.();
        this._enqueueSteps(pending);
        this._processActionQueue();
      }
    }

    this._processActionQueue();
  }

  renderScriptModal(ctx, font, uiTick) {
    if (!this.modal || !font) return;
    if (this.modal.type === 'dialog') {
      const result = renderTalkDialog(ctx, { engine: this.engine, font, modal: this.modal, uiTick, layout: this.dialogLayout });
      this._choiceBoxes = result.choiceBoxes;
      this._dialogExitBox = result.dialogExitBox;
      return;
    }
    if (this.modal.type === 'form') {
      renderTextForm(ctx, { assets: this.engine.assets, font, modal: this.modal, uiTick });
      this._choiceBoxes = [];
      this._dialogExitBox = null;
      this._inventoryItemBoxes = [];
      this._inventoryControlBoxes = [];
      return;
    }
    if (this.modal.type === 'inventory') {
      const result = renderInventoryScreen(ctx, {
        assets: this.engine.assets,
        font,
        modal: this.modal,
        selectedItem: this.selectedItem,
      });
      this._choiceBoxes = [];
      this._dialogExitBox = null;
      this._inventoryItemBoxes = result.itemBoxes;
      this._inventoryControlBoxes = result.controlBoxes;
      return;
    }
    if (this.modal.presentation === 'resource') {
      renderResourcePopup(ctx, { assets: this.engine.assets, modal: this.modal });
      this._choiceBoxes = [];
      this._dialogExitBox = null;
      this._inventoryItemBoxes = [];
      this._inventoryControlBoxes = [];
      return;
    }
    if (this.modal.presentation === 'talk') {
      const result = renderTalkResponse(ctx, { engine: this.engine, font, modal: this.modal, uiTick, layout: this.dialogLayout });
      this._choiceBoxes = result.choiceBoxes;
      this._dialogExitBox = result.dialogExitBox;
      this._inventoryItemBoxes = [];
      this._inventoryControlBoxes = [];
      return;
    }
    renderNotePopup(ctx, { assets: this.engine.assets, font, modal: this.modal, layout: this.noteLayout });
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    this._inventoryItemBoxes = [];
    this._inventoryControlBoxes = [];
  }

  _queueEvent(eventId) {
    const event = this.sceneScript.events?.[eventId];
    if (!event) return;
    this.actionQueue = [];
    this._enqueueSteps(event);
    this._processActionQueue();
  }

  _enqueueSteps(steps) {
    const list = Array.isArray(steps) ? steps : [steps];
    this.actionQueue.push(...list.map((step) => ({ ...step })));
  }

  _processActionQueue() {
    if (this.modal || this._isScriptBusy?.()) return;
    while (this.actionQueue.length) {
      const step = this.actionQueue.shift();
      if (step.if) {
        this._enqueueSteps(this._evaluateCondition(step.if) ? step.then : step.else);
        continue;
      }
      if (step.type === 'event') {
        this._enqueueSteps(this.sceneScript.events?.[step.id]);
        continue;
      }
      if (step.type === 'walkTo') {
        this._walkTo?.(step.x, step.y);
        return;
      }
      if (step.type === 'face') {
        this._face?.(step.dir);
        continue;
      }
      if (step.type === 'message') {
        this._openMessage(step.id);
        return;
      }
      if (step.type === 'dialog') {
        this._openDialog(step.id);
        return;
      }
      if (step.type === 'form') {
        this._openForm(step.id);
        return;
      }
      if (step.type === 'setState') {
        this.state[step.key] = step.value;
        this._applyBindings();
        this._afterStateChanged?.(step.key);
        continue;
      }
      if (step.type === 'incState') {
        this.state[step.key] = (this.state[step.key] || 0) + (step.amount ?? 1);
        this._applyBindings();
        this._afterStateChanged?.(step.key);
        continue;
      }
      if (step.type === 'transition') {
        this._stopSound();
        this._requestTransition(step.target);
        return;
      }
      if (step.type === 'sceneAnimation') {
        this._playSceneAnimation?.(step);
        return;
      }
    }
  }

  _openMessage(messageId) {
    const message = this.sceneScript.messages?.[messageId];
    if (!message) return;
    this._stopSound();
    this._dialogExitBox = null;
    this._inventoryItemBoxes = [];
    this._inventoryControlBoxes = [];
    this.modal = { id: messageId, type: 'message', presentation: message.presentation || 'note', speakerTalking: false, locked: false, ...message };
    this._afterModalChanged?.();
    this._refreshCursor?.();
    if (this.modal.presentation === 'talk' && this.modal.sound) {
      this.modal.speakerTalking = true;
      this.modal.locked = true;
      this._playModalSound(this.modal.sound, () => {
        if (this.modal?.type !== 'message') return;
        this.modal.speakerTalking = false;
        this.modal.locked = false;
      });
    }
  }

  _openDialog(dialogId, options = {}) {
    const dialog = this.sceneScript.dialogs?.[dialogId];
    if (!dialog) return;
    this._stopSound();
    this._dialogExitBox = null;
    this._inventoryItemBoxes = [];
    this._inventoryControlBoxes = [];
    this.modal = {
      id: dialogId,
      type: 'dialog',
      speaker: dialog.speaker,
      speakerSprite: dialog.speakerSprite,
      speakerBase: dialog.speakerBase,
      speakerFrames: dialog.speakerFrames,
      speakerStaticOverlay: dialog.speakerStaticOverlay,
      speakerOverlay: dialog.speakerOverlay,
      prompt: dialog.prompt,
      promptSound: dialog.promptSound || null,
      question: dialog.question,
      choices: dialog.choices,
      selectedChoice: null,
      phase: dialog.promptSound ? 'npcPrompt' : 'choice',
      speakerTalking: false,
      alexTalking: false,
      replyTick: 0,
      replyDurationTicks: 0,
    };
    this._afterModalChanged?.();
    this._refreshCursor?.();
    if (dialog.promptSound) {
      if (options.deferPromptSound) this._gestureLockedDialog = dialog;
      else this._startDialogPrompt(dialog);
    }
  }

  _openForm(formId) {
    const form = this.sceneScript.forms?.[formId];
    if (!form) return;
    this._stopSound();
    this._dialogExitBox = null;
    this._inventoryItemBoxes = [];
    this._inventoryControlBoxes = [];
    this.modal = {
      type: 'form',
      id: formId,
      asset: form.asset,
      fields: form.fields,
      values: form.fields.map(() => ''),
      accepted: form.fields.map(() => false),
      mistakes: form.fields.map(() => 0),
      autoFilled: form.fields.map(() => false),
      activeField: 0,
      awaitingSubmitConfirm: false,
      errorText: '',
      errorColor: form.errorColor || '#000000',
      errorY: form.errorY || 172,
      reminder: form.reminder || '',
    };
    this._afterModalChanged?.();
    this._refreshCursor?.();
  }

  _startDialogPrompt(dialog) {
    if (!this.modal || this.modal.type !== 'dialog') return;
    this.modal.phase = 'npcPrompt';
    this.modal.speakerTalking = true;
    this._playModalSound(dialog.promptSound, () => {
      if (this.modal?.type !== 'dialog') return;
      this.modal.phase = 'choice';
      this.modal.speakerTalking = false;
    });
  }

  _confirmDialogChoice(choiceIdx) {
    if (!this.modal || this.modal.type !== 'dialog') return;
    const choice = this.modal.choices[choiceIdx];
    if (!choice) return;
    this.modal.selectedChoice = choiceIdx;
    this.modal.phase = 'alexReply';
    this.modal.speakerTalking = false;
    this.modal.alexTalking = true;
    this.modal.replyTick = 0;
    this._choiceBoxes = [];
    this._dialogExitBox = null;
    const finish = () => {
      if (this.modal?.type !== 'dialog') return;
      this.modal.alexTalking = false;
      this.modal.phase = 'alexPause';
      this._pendingDialogChoiceEvent = choice.event;
      this._pendingDialogDelayTicks = this.dialogResponseDelayTicks;
    };
    if (choice.responseSound) this._playModalSound(choice.responseSound, finish);
    else finish();
  }

  _playModalSound(name, onended) {
    this._stopSound();
    const src = this.engine.playSound(name);
    this.currentSound = src;
    if (src?.buffer && this.modal?.type === 'dialog' && this.modal.phase === 'alexReply') {
      this.modal.replyDurationTicks = Math.max(1, Math.round((src.buffer.duration * 1000) / 55));
    }
    if (src) {
      src.onended = () => {
        if (this.currentSound === src) this.currentSound = null;
        if (onended) onended();
      };
    } else if (onended) {
      onended();
    }
  }

  _stopSound() {
    if (!this.currentSound) return;
    try { this.currentSound.stop(); } catch {}
    this.currentSound = null;
  }

  _handleModalClick(mx, my) {
    if (!this.modal) return;
    if (this.modal.type === 'message') {
      if (this.modal.locked) return;
      this._stopSound();
      const resumeModal = this.modal.returnModal || null;
      this.modal = resumeModal;
      this._afterModalChanged?.();
      this._refreshCursor?.();
      if (!resumeModal) this._processActionQueue();
      return;
    }
    if (this.modal.type === 'inventory') {
      if (this.modal.inspectItem) {
        this.modal.inspectItem = null;
        this._afterModalChanged?.();
        this._refreshCursor?.();
        return;
      }
      for (const box of this._inventoryControlBoxes) {
        if (mx >= box.x1 && mx <= box.x2 && my >= box.y1 && my <= box.y2) {
          if (box.mode === 'exit') {
            this._closeInventory?.();
          } else if (this.modal) {
            this.modal.mode = box.mode;
          }
          return;
        }
      }
      for (const box of this._inventoryItemBoxes) {
        if (mx >= box.x1 && mx <= box.x2 && my >= box.y1 && my <= box.y2) {
          this._handleInventoryItemClick?.(box.itemId);
          return;
        }
      }
      this._closeInventory?.();
      return;
    }
    if (this.modal.type !== 'dialog' || this.modal.phase !== 'choice') return;
    if (this._dialogExitBox && mx >= this._dialogExitBox.x1 && mx <= this._dialogExitBox.x2 && my >= this._dialogExitBox.y1 && my <= this._dialogExitBox.y2) {
      this._stopSound();
      this.modal = null;
      this._choiceBoxes = [];
      this._dialogExitBox = null;
      this.actionQueue = [];
      this._afterModalChanged?.();
      this._refreshCursor?.();
      return;
    }
    for (let i = 0; i < this._choiceBoxes.length; i++) {
      const box = this._choiceBoxes[i];
      if (mx >= box.x1 && mx <= box.x2 && my >= box.y1 && my <= box.y2) {
        this.modal.selectedChoice = i;
        return;
      }
    }
  }

  _evaluateCondition(condition) {
    if (!condition) return true;
    const value = this.state[condition.state];
    if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return value === condition.equals;
    if (Object.prototype.hasOwnProperty.call(condition, 'gte')) return value >= condition.gte;
    if (Object.prototype.hasOwnProperty.call(condition, 'lte')) return value <= condition.lte;
    return Boolean(value);
  }

  _applyBindings() {
    for (const binding of this.sceneScript.bindings || []) {
      const active = this._evaluateCondition(binding.when);
      if (binding.type === 'objectVisible') {
        const obj = this.objectByName?.[binding.object];
        if (obj) obj.visible = active;
      } else if (binding.type === 'interactionEnabled') {
        this._interactionEnabled[binding.interaction] = active;
      }
    }
  }

  _queueFallbackEvent(mode) {
    const eventId = this.sceneScript.fallbacks?.[mode];
    if (eventId) this._queueEvent(eventId);
  }

  _requestTransition(target) {
    if (!target || typeof this.onTransition !== 'function') return;
    this.onTransition(target);
  }
}
