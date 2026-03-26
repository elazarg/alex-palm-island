// SCX animation interpreter
// Executes animation command sections paired with position data sections.
//
// Core model:
//   - The data section is an array of (x, y) entries, one per animation frame.
//     Entry index N corresponds to sprite frame N (1-indexed: LOGO1, LOGO2, ...).
//   - P steps through entries sequentially, advancing both position and frame.
//   - G jumps to a specific entry index.
//   - F overrides just the displayed frame (without changing the data index).
//   - V toggles visibility.

export class AnimationPlayer {
  constructor(commands, positions, objectName) {
    this.commands = commands;
    this.positions = positions; // [{x, y}, ...] 0-indexed internally
    this.objectName = objectName;

    this.pc = 0;           // program counter into commands
    this.dataIndex = 0;    // current index into positions/frames (0-indexed)
    this.frame = 1;        // displayed frame number (1-indexed, for sprite name)
    this.visible = false;
    this.x = 0;
    this.y = 0;
    this.done = false;

    // Timed state
    this.waitTicks = 0;
    this.stepping = null; // {remaining, delay, delayCounter}
  }

  get spriteName() {
    return `${this.objectName}${this.frame}`;
  }

  tick() {
    if (this.done) return;

    // Stepping through positions (P command)
    if (this.stepping) {
      const s = this.stepping;
      s.delayCounter--;
      if (s.delayCounter <= 0) {
        this._stepToCurrentEntry();
        this.dataIndex++;
        s.remaining--;
        if (s.remaining <= 0) {
          this.stepping = null;
        } else {
          s.delayCounter = s.delay;
        }
      }
      return;
    }

    // Waiting (F command with duration)
    if (this.waitTicks > 0) {
      this.waitTicks--;
      return;
    }

    this._run();
  }

  // Apply position and frame from current dataIndex
  _stepToCurrentEntry() {
    if (this.dataIndex >= 0 && this.dataIndex < this.positions.length) {
      const pos = this.positions[this.dataIndex];
      this.x = pos.x;
      this.y = pos.y;
      this.frame = this.dataIndex + 1; // 1-indexed frame
    }
  }

  _run() {
    while (this.pc < this.commands.length) {
      const cmd = this.commands[this.pc];
      this.pc++;

      switch (cmd.op) {
        case 'P': {
          // P count, delay — step through count entries from current dataIndex.
          // Each step sets position + frame from the data section.
          // Minimum ticks per step so animation is visible.
          // Original DOS engine runs at 18.2 Hz; each step likely took
          // several frames. 4 ticks ≈ 220ms per frame for smooth bounce.
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
          return; // yield — show this frame for at least 1 tick
        }

        case 'G': {
          // G index, 0 — jump dataIndex (1-indexed in SCX)
          const idx = cmd.args[0] - 1;
          if (idx >= 0 && idx < this.positions.length) {
            this.dataIndex = idx;
            this._stepToCurrentEntry();
          }
          break;
        }

        case 'F': {
          // F frame, duration — override displayed frame, optionally wait
          this.frame = cmd.args[0];
          const duration = cmd.args[1];
          if (duration > 0) {
            this.waitTicks = duration * 4; // scale to match P timing
            return;
          }
          break;
        }

        case 'V': {
          this.visible = cmd.args[0] === 1;
          break;
        }

        case 'Q': {
          this.done = true;
          return;
        }

        default:
          break;
      }
    }
    this.done = true;
  }
}

export function parseAnimationCommands(lines) {
  return lines.map(line => {
    const trimmed = line.trim();
    if (trimmed === 'Q') return { op: 'Q', args: [] };
    if (trimmed.length >= 2 && trimmed[1] === ' ') {
      const op = trimmed[0];
      const args = trimmed.slice(2).split(',').map(s => parseInt(s.trim(), 10));
      return { op, args };
    }
    return null;
  }).filter(Boolean);
}

export function parsePositionData(lines) {
  return lines.map(line => {
    const [x, y] = line.trim().split(',').map(s => parseInt(s.trim(), 10));
    return { x, y };
  });
}
