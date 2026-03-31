export class AnimationPlayer {
  constructor(commands, positions, objectName) {
    this.commands = commands;
    this.positions = positions;
    this.objectName = objectName;

    this.pc = 0;
    this.dataIndex = 0;
    this.frame = 1;
    this.visible = false;
    this.x = 0;
    this.y = 0;
    this.done = false;
    this.waitTicks = 0;
    this.stepping = null;
  }

  get spriteName() {
    return `${this.objectName}${this.frame}`;
  }

  tick() {
    if (this.done) return;

    if (this.stepping) {
      const state = this.stepping;
      state.delayCounter--;
      if (state.delayCounter <= 0) {
        this._stepToCurrentEntry();
        this.dataIndex++;
        state.remaining--;
        if (state.remaining <= 0) {
          this.stepping = null;
        } else {
          state.delayCounter = state.delay;
        }
      }
      return;
    }

    if (this.waitTicks > 0) {
      this.waitTicks--;
      return;
    }

    this._run();
  }

  _stepToCurrentEntry() {
    if (this.dataIndex >= 0 && this.dataIndex < this.positions.length) {
      const pos = this.positions[this.dataIndex];
      this.x = pos.x;
      this.y = pos.y;
      this.frame = this.dataIndex + 1;
    }
  }

  _run() {
    while (this.pc < this.commands.length) {
      const cmd = this.commands[this.pc];
      this.pc++;

      switch (cmd.op) {
        case 'P': {
          const count = cmd.args[0];
          const delay = Math.max(cmd.args[1], 4);
          this._stepToCurrentEntry();
          this.dataIndex++;
          if (count > 1) {
            this.stepping = {
              remaining: count - 1,
              delay,
              delayCounter: delay,
            };
          }
          return;
        }
        case 'G': {
          const idx = cmd.args[0] - 1;
          if (idx >= 0 && idx < this.positions.length) {
            this.dataIndex = idx;
            this._stepToCurrentEntry();
          }
          break;
        }
        case 'F': {
          this.frame = cmd.args[0];
          const duration = cmd.args[1];
          if (duration > 0) {
            this.waitTicks = duration * 4;
            return;
          }
          break;
        }
        case 'V':
          this.visible = cmd.args[0] === 1;
          break;
        case 'Q':
          this.done = true;
          return;
        default:
          break;
      }
    }
    this.done = true;
  }
}

export function parseAnimationCommands(lines) {
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed === 'Q') return { op: 'Q', args: [] };
    if (trimmed.length >= 2 && trimmed[1] === ' ') {
      return {
        op: trimmed[0],
        args: trimmed.slice(2).split(',').map((part) => parseInt(part.trim(), 10)),
      };
    }
    return null;
  }).filter(Boolean);
}

export function parsePositionData(lines) {
  return lines.map((line) => {
    const [x, y] = line.trim().split(',').map((part) => parseInt(part.trim(), 10));
    return { x, y };
  });
}
