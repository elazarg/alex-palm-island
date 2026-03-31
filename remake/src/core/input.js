export class InputController {
  constructor(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.mouseX = -1;
    this.mouseY = -1;

    this._onMouseMove = (e) => {
      const { x, y } = this._toGameCoords(e);
      this.mouseX = x;
      this.mouseY = y;
      this._dispatch('onMouseMove', { x, y, originalEvent: e });
    };
    this._onMouseLeave = (e) => {
      this.mouseX = -1;
      this.mouseY = -1;
      this._dispatch('onMouseLeave', { originalEvent: e });
    };
    this._onMouseDown = (e) => {
      const { x, y } = this._toGameCoords(e);
      this.engine.resumeAudio();
      this._dispatch('onMouseDown', { x, y, button: e.button, originalEvent: e });
    };
    this._onMouseUp = (e) => {
      const { x, y } = this._toGameCoords(e);
      this._dispatch('onMouseUp', { x, y, button: e.button, originalEvent: e });
    };
    this._onWheel = (e) => {
      const { x, y } = this._toGameCoords(e);
      this._dispatch('onWheel', { x, y, deltaX: e.deltaX, deltaY: e.deltaY, originalEvent: e });
    };
    this._onKeyDown = (e) => {
      this._dispatch('onKeyDown', { key: e.key, originalEvent: e });
    };
  }

  attach() {
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseleave', this._onMouseLeave);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
  }

  _toGameCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / (rect.width / this.engine.width),
      y: (e.clientY - rect.top) / (rect.height / this.engine.height),
    };
  }

  _dispatch(handlerName, payload) {
    const scene = this.engine.scene;
    if (scene && typeof scene[handlerName] === 'function') {
      scene[handlerName](payload);
    }
  }
}
