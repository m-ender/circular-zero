// gl is a WebGL context
function StencilBuffer(gl) {
    this.gl = gl;
    this.clear();
    return this;
}

StencilBuffer.prototype.clear = function() {
    this.gl.clear(gl.STENCIL_BUFFER_BIT);
};

StencilBuffer.prototype.enable = function() {
    this.gl.enable(gl.STENCIL_TEST);
};

StencilBuffer.prototype.disable = function() {
    this.gl.disable(gl.STENCIL_TEST);
};

// Disables drawing to the color buffer
StencilBuffer.prototype.incrementOnRender = function() {
    gl.stencilFunc(gl.NEVER, 0, 0);
    gl.stencilOp(gl.INCR, gl.KEEP, gl.KEEP);
};

// Disables drawing to the color buffer
StencilBuffer.prototype.decrementOnRender = function() {
    gl.stencilFunc(gl.NEVER, 0, 0);
    gl.stencilOp(gl.DECR, gl.KEEP, gl.KEEP);
};

// Leaves the stencil buffer untouched
StencilBuffer.prototype.renderToColorBuffer = function() {
    // Only render pixels whose stencil value is zero.
    gl.stencilFunc(gl.EQUAL, 0, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
};
