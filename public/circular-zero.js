var debug = false;

var canvas;
var messageBox;
var debugBox;

var gl;
var stencilBuffer;

var colorGenerator;

// Objects holding data for individual shader programs
var circleProgram = {};
var lineProgram = {};

// Textures
// We will use three textures, whose roles will be shifted circularly every frame
// One texture is the one we are currently rendering to (and subsequently displaying)
// One texture is the one that is currently displayed and was rendered last frame
// One texture is the one that was displayed last frame and rendered two frames ago
// (We need to remember two previous frames in order to apply our finite difference scheme, as the wave equation is of second order in time)
var textures = [];
var rttFramebuffers = []; // Render to texture memory (this will store 3 framebuffers corresponding to the three textures)
var resolution = 512; // We're assuming a square aspect ratio
var viewPort = {};

var renderScale = 0.9; // means that the coordinate range [-1, 1] will fill 90% of the viewport
                       // the scaling is done in the shaders, but is has to be respected in obtaining coordinates from the mouse position

var previousTexture; // Points to the texture from two frames ago, so that we only ever need to add to this value (makes module maths simpler)

// Timing
// We need these to fix the framerate
var fps = 60;
var interval = 1000/fps;
var lastTime;

var rootCircle = null;

var cursor = null;

var activeLine = null;
var activeCircle = null;

var affectedLeaves = null;

var totalArea = 0;

var enemies = [];

var mouseDown = false;
var cursorMoving = false;
var target = null; // Could be either a .toDistance for activeLine or a .toAngle for activeCircle
var direction = null; // Only necessary for motion around activeCircle

// Gameplay configuration
var cursorSpeed = 1; // given in length units per second

var enemyRadius = 0.025;
var enemySpeed = 0.3; // given in length units per second

window.onload = init;

function init()
{
    canvas = document.getElementById("gl-canvas");

    // This is the size we are rendering to
    viewPort.width = resolution;
    viewPort.height = resolution;
    // This is the actual extent of the canvas on the page
    canvas.style.width = viewPort.width;
    canvas.style.height = viewPort.height;
    // This is the resolution of the canvas (which will be scaled to the extent, using some rather primitive anti-aliasing techniques)
    canvas.width = viewPort.width;
    canvas.height = viewPort.height;

    // By attaching the event to document we can control the cursor from
    // anywhere on the page and can even drag off the browser window.
    document.addEventListener('mousedown', handleMouseDown, false);
    document.addEventListener('mouseup', handleMouseUp, false);
    document.addEventListener('mousemove', handleMouseMove, false);

    messageBox = $('#message');
    debugBox = $('#debug');

    if (!debug)
        renderInstructions();

    gl = WebGLUtils.setupWebGL(canvas, {stencil: true});
    if (!gl) {
        messageBox.html("WebGL is not available!");
    } else {
        messageBox.html("WebGL up and running!");
    }

    stencilBuffer = new StencilBuffer(gl);

    gl.clearColor(1, 1, 1, 1);

    // Load shaders and get uniform locations
    circleProgram.program = InitShaders(gl, "circle-vertex-shader", "minimal-fragment-shader");
    // add uniform locations
    circleProgram.uRenderScale = gl.getUniformLocation(circleProgram.program, "uRenderScale");
    circleProgram.uCenter = gl.getUniformLocation(circleProgram.program, "uCenter");
    circleProgram.uR = gl.getUniformLocation(circleProgram.program, "uR");
    circleProgram.uFromAngle = gl.getUniformLocation(circleProgram.program, "uFromAngle");
    circleProgram.uToAngle = gl.getUniformLocation(circleProgram.program, "uToAngle");
    // add attribute locations
    circleProgram.aPos = gl.getAttribLocation(circleProgram.program, "aPos");
    circleProgram.aColor = gl.getAttribLocation(circleProgram.program, "aColor");

    // fill uniforms that are already known
    gl.useProgram(circleProgram.program);
    gl.uniform1f(circleProgram.uRenderScale, renderScale);

    lineProgram.program = InitShaders(gl, "line-vertex-shader", "minimal-fragment-shader");
    // add uniform locations
    lineProgram.uRenderScale = gl.getUniformLocation(lineProgram.program, "uRenderScale");
    lineProgram.uAngle = gl.getUniformLocation(lineProgram.program, "uAngle");
    lineProgram.uToDistance = gl.getUniformLocation(lineProgram.program, "uToDistance");
    // add attribute locations
    lineProgram.aPos = gl.getAttribLocation(lineProgram.program, "aPos");
    lineProgram.aColor = gl.getAttribLocation(lineProgram.program, "aColor");

    gl.useProgram(lineProgram.program);
    gl.uniform1f(lineProgram.uRenderScale, renderScale);

    gl.useProgram(null);

    enemies.push(new Enemy(0, 0.5*0.975, enemySpeed, pi, enemyRadius));
    enemies.push(new Enemy(0.5*cos(-pi/6)*0.975, 0.5*sin(-pi/6)*0.975, enemySpeed, pi/3, enemyRadius));
    enemies.push(new Enemy(0.5*cos(-5*pi/6)*0.975, 0.5*sin(-pi/6)*0.975, enemySpeed, -pi/3, enemyRadius));

    var innerLeafNode = new OpenLeaf(enemies.slice());
    var outerLeafNode = new ClosedLeaf();
    innerLeafNode.area = 1; // we are only interested in the relative area
    outerLeafNode.area = 0; // don't count what's outside the main game arena
    rootCircle = new InnerNode(null, new Circle(0, 0, 1, CircleType.Circumference), 1, innerLeafNode, outerLeafNode);
    cursor = new Circle(1, 0, 0.025, CircleType.Inside, 0, 2*pi, [0, 0.7, 0]);

    colorGenerator = new ColorGenerator();

    if (debug)
        displayTree();

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    CheckError();

    lastTime = Date.now();
    update();
}

function renderInstructions()
{
    debugBox.html('Progress: <span id="area">0</span>%<br><br>' +
                  '================================<br><br>' +
                  'Goal:<br><br>' +
                  'Color in 75% of the area!<br><br>' +
                  'How to play:<br>' +
                  '<ul>' +
                  '  <li>Click and hold to lock the green cursor\'s position.' +
                  '  <li>Drag to choose path.' +
                  '  <li>Release to build wall.' +
                  '</ul>' +
                  '<ul class="attention">' +
                  '  <li>Areas that don\'t contain enemies will be colored in.' +
                  '  <li>If the cursor or the wall is hit while a wall is being built, you lose the wall!');
}

function InitShaders(gl, vertexShaderId, fragmentShaderId)
{
    var vertexShader;
    var fragmentShader;

    var vertexElement = document.getElementById(vertexShaderId);
    if(!vertexElement)
    {
        messageBox.html("Unable to load vertex shader '" + vertexShaderId + "'");
        return -1;
    }
    else
    {
        vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexElement.text);
        gl.compileShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        {
            messageBox.html("Vertex shader '" + vertexShaderId + "' failed to compile. The error log is:</br>" + gl.getShaderInfoLog(vertexShader));
            return -1;
        }
    }

    var fragmentElement = document.getElementById(fragmentShaderId);
    if(!fragmentElement)
    {
        messageBox.html("Unable to load fragment shader '" + fragmentShaderId + "'");
        return -1;
    }
    else
    {
        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentElement.text);
        gl.compileShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        {
            messageBox.html("Fragment shader '" + fragmentShaderId + "' failed to compile. The error log is:</br>" + gl.getShaderInfoLog(fragmentShader));
            return -1;
        }
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        messageBox.html("Shader program failed to link. The error log is:</br>" + gl.getProgramInfoLog(program));
        return -1;
    }

    return program;
}

// This is a fixed-framerate game loop.
function update()
{
    window.requestAnimFrame(update, canvas);

    currentTime = Date.now();
    var dTime = currentTime - lastTime;

    if (dTime > interval)
    {
        // Uncomment to see dropped frames
        //frames (dTime > 2*interval) console.log("UpsX" + Math.floor(dTime/interval));

        // The modulo is to take care of the case that we skipped a frame
        lastTime = currentTime - (dTime % interval);

        if (cursorMoving)
        {
            runMonteCarlo(100);
            moveCursor(dTime);
        }

        moveEnemies(dTime);

        drawScreen();
    }
}

function drawScreen()
{
    gl.enable(gl.BLEND);

    gl.viewport(0, 0, viewPort.width, viewPort.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    stencilBuffer.enable();
    rootCircle.render();
    stencilBuffer.disable();

    cursor.render(CircleType.Inside);
    for (var i = 0; i < enemies.length; ++i)
        enemies[i].render();

    if (activeCircle)
        activeCircle.render(CircleType.Circumference);

    if (activeLine)
        activeLine.render(LineType.Line);

    gl.disable(gl.BLEND);
}

function moveCursor(dTime)
{
    var endPoint;

    if (activeLine)
    {
        activeLine.toDistance += cursorSpeed * dTime / 1000;

        if (activeLine.toDistance >= target)
        {
            activeLine.destroy();
            cursorMoving = false;
        }

        endPoint = activeLine.getEndPoint();
        cursor.x = endPoint.x;
        cursor.y = endPoint.y;
    }
    else if (activeCircle)
    {
        // ds = r*dtheta --> dtheta = ds / r
        activeCircle.toAngle += direction * cursorSpeed * dTime / 1000 / activeCircle.r;

        if (direction * activeCircle.toAngle >= direction * target)
        {
            activeCircle.destroy();
            cursorMoving = false;
        }

        endPoint = activeCircle.getEndPoint();
        cursor.x = endPoint.x;
        cursor.y = endPoint.y;
    }

    if (!cursorMoving)
    {
        activeLine = null;
        activeCircle = null;

        for (var i = 0; i < affectedLeaves.length; ++i)
            affectedLeaves[i].subdivide();

        affectedLeaves = null;

        recalculateArea();
    }
}

function moveEnemies(dTime) {
    for (var j = 0; j < openLeaves.length; ++j)
    {
        var o = openLeaves[j];
        for (var k = 0; k < o.enemies.length; ++k)
        {
            // Move enemies and resolve collisions with walls
            var e = o.enemies[k];

            var dvleft = e.v * dTime / 1000;
            while (dvleft > 1e-6)
            {
                var lastChild = o;
                var nearestN = null;
                var nearestD2 = dvleft*dvleft;
                var nearestR = null;
                var nearestSign = null;
                var nearestAOI = null;

                var currentNode;
                while ((currentNode = lastChild.parent) !== null)
                {
                    // Several of the following calculations change their sign
                    // depending on what side of the geometry they are on
                    var sign;
                    if (lastChild === currentNode.lChild)
                        sign = -1;
                    else
                        sign = 1;

                    if (currentNode.geometry instanceof Circle)
                    {
                        // Compute the distance from the centre of the circle
                        var dx = currentNode.geometry.x - e.x;
                        var dy = currentNode.geometry.y - e.y;
                        var dc = sqrt(dx*dx + dy*dy);

                        // We now transform the collision problem into an equivalent
                        // one where the enemy is just a point and we add its radius
                        // to that of the wall.
                        var r = currentNode.geometry.r + sign * e.geometry.r;
                        var d = sign * (dc - r);

                        // Only look for an intersection we're closer than we can possibly
                        // travel.
                        if (d < dvleft)
                        {
                            // The line (e.x,e.y) + mu (e.vy,e.vy) is the line along which the
                            // enemy moves (with the direction being normalised).

                            // Project the centre of the circle onto that vector (dot product).
                            // Going this distance along the line will lead to the point halfway
                            // between the intersections.
                            var mu = e.vx * dx + e.vy * dy;

                            // Project centre of the circle onto a vector perpendicular to the line.
                            // This will be the perpendicular distance from the line.
                            d = e.vx * dy - e.vy * dx;

                            // Use Pythagoras to get the distance along the line to the two intersections.
                            var dmu = sqrt(r * r - d * d);

                            // Determine vector from enemy to collision coordinates and it's squared length
                            var cx = e.vx * (mu - sign * dmu);
                            var cy = e.vy * (mu - sign * dmu);
                            var c2 = cx * cx + cy * cy;
                            if (c2 < nearestD2)
                            {
                                nearestD2 = c2;
                                nearestR = r;
                                nearestN = currentNode;
                                nearestSign = sign;
                            }
                        }
                    }
                    else
                    {
                        var lAngle = currentNode.geometry.angle;

                        // Create a normalised vector perpendicular to the line.
                        var x = cos(lAngle - sign*pi/2);
                        var y = sin(lAngle - sign*pi/2);

                        // Project the centre and velocity of the enemy onto
                        // that vector (dot product).

                        // This will be the perpendicular distance from the line
                        // taking into account the enemy's radius.
                        var de = x * e.x + y * e.y - e.geometry.r;
                        // This will be negative if we're moving towards the line
                        var dev = x * e.vx + y * e.vy;

                        // Only look for an intersection if we're closer than we can
                        // possibly travel and if we're travelling towards the line.
                        if (dev < 0 && de < dvleft)
                        {
                            // Get angle of incidence (relative to normal)
                            var aoi = lAngle + sign*pi/2 - e.angle;

                            // Get the square of the actual distance to be travelled
                            var d2 = de / cos(aoi);
                            d2 = d2*d2;

                            if (d2 < nearestD2)
                            {
                                nearestD2 = d2;
                                nearestAOI = aoi;
                                nearestSign = sign;
                                nearestN = currentNode;
                            }
                        }
                    }

                    lastChild = currentNode;
                }

                var dv = sqrt(nearestD2);
                e.x += e.vx * dv;
                e.y += e.vy * dv;

                if (nearestN)
                {
                    if (nearestN.geometry instanceof Circle)
                    {
                        // Find vector from geometry centre to collision point
                        var px = nearestSign*(nearestN.geometry.x - e.x);
                        var py = nearestSign*(nearestN.geometry.y - e.y);

                        var dAngle = atan2(py, px) - e.angle;

                        e.setAngle(e.angle + 2*dAngle + pi);

                        /*
                        // Project velocity onto that vector
                        var p = e.vx * px + e.vy * py;

                        // Reflection vector is opposite to twice that projection along
                        // the vector. Also do normalisation now.
                        var rx = px * p/nearestR;
                        var ry = py * p/nearestR;
                        e.vx -= 2*rx;
                        e.vy -= 2*ry;
                        */
                    }
                    else
                    {
                        e.setAngle(e.angle + 2*nearestAOI + pi);
                    }
                }

                dvleft -= dv;
            }

            e.geometry.x = e.x;
            e.geometry.y = e.y;

            // Check for collisions with moving cursor or growing geometry
            if (cursorMoving)
            {
                if (e.geometry.collidesWith(cursor))
                    abortNewGeometry();

                if (o.geometry && e.geometry.collidesWith(o.geometry))
                {
                    if (activeCircle)
                    {
                        // Get angle of intersection
                        var xp = e.x - activeCircle.x;
                        var yp = e.y - activeCircle.y;

                        var iAngle = atan2(yp, xp);

                        // Make sure the distance between fromAngle and iAngle is less than pi
                        if (iAngle - activeCircle.fromAngle > pi)
                            iAngle -= 2*pi;
                        else if (iAngle - activeCircle.fromAngle < -pi)
                            iAngle += 2*pi;

                        // Take care of the fact that toAngle can be growing in the positive
                        // or the negative direction.
                        if (iAngle > activeCircle.fromAngle && iAngle < activeCircle.toAngle ||
                            iAngle < activeCircle.fromAngle && iAngle > activeCircle.toAngle
                        ) {
                            abortNewGeometry();
                        }
                    }
                    else
                    {
                        // Get position of enemy along line by projection
                        var lx = cos(activeLine.angle);
                        var ly = sin(activeLine.angle);

                        var emu = lx*e.x + ly*e.y;

                        if (emu < activeLine.toDistance)
                            abortNewGeometry();
                    }
                }
            }
        }
    }
}

function abortNewGeometry() {
    cursorMoving = false;

    var endPoint;
    if (activeCircle)
    {
        activeCircle.toAngle = activeCircle.fromAngle;
        endPoint = activeCircle.getEndPoint();
        activeCircle.destroy();
        activeCircle = null;
    }
    else
    {
        activeLine.toDistance = -1;
        endPoint = activeLine.getEndPoint();
        activeLine.destroy();
        activeLine = null;
    }

    cursor.x = endPoint.x;
    cursor.y = endPoint.y;

    // All leaves share the same geometry object
    if (affectedLeaves.length)
        affectedLeaves[0].geometry.destroy();

    for (var i = 0; i < affectedLeaves.length; ++i)
    {
        affectedLeaves[i].geometry = null;
        affectedLeaves[i].lChildSamples = 0;
        affectedLeaves[i].rChildSamples = 0;
    }

    affectedLeaves = null;
}

function handleMouseMove(event) {
    if (cursorMoving)
        return;

    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    if (debug)
    {
        debugBox.find('#xcoord').html(coords.x);
        debugBox.find('#ycoord').html(coords.y);
    }

    if (mouseDown)
    {
        if (snapToLine(coords.x, coords.y))
        {
            activeCircle.hide();
            activeLine.show();
        }
        else
        {
            activeCircle.show();
            activeLine.hide();

            // Calculate position of the circle, based on cursor
            // and mouse position.

            var mu = (pow(cursor.x - coords.x, 2) + pow(cursor.y - coords.y, 2)) / (cursor.x * coords.y - cursor.y * coords.x);

            var x = cursor.x - mu * cursor.y / 2;
            var y = cursor.y + mu * cursor.x / 2;

            activeCircle.move(x, y);

            activeCircle.resize(sqrt(pow(x - cursor.x, 2) + pow(y - cursor.y, 2)));
        }
    }
    else
    {
        var angle = atan2(coords.y, coords.x);

        cursor.move(cos(angle), sin(angle));
    }
}

function handleMouseDown(event) {
    if (cursorMoving)
        return;

    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    if (debug)
    {
        debugBox.find('#xdown').html(coords.x);
        debugBox.find('#ydown').html(coords.y);
    }

    var newColor = colorGenerator.nextColor(true);
    newColor =  [newColor.red()/255, newColor.green()/255, newColor.blue()/255];

    mouseDown = true;
    activeLine = new Line(atan2(-cursor.y, -cursor.x), LineType.Line, 1, newColor);

    // This position is arbitrary. When the user clicks, the
    // line will always be shown and the circles parameters
    // will be recalculated as soon as the mouse is moved.
    activeCircle = new Circle(cursor.x, cursor.y, 0.2, CircleType.Circumference, 0, 2*pi, newColor);
    activeCircle.hide();
}

function handleMouseUp(event) {
    if (cursorMoving)
        return;

    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    if (debug)
    {
        debugBox.find('#xup').html(coords.x);
        debugBox.find('#yup').html(coords.y);
    }

    mouseDown = false;

    if (!activeCircle.hidden)
    {
        activeLine.destroy();
        activeLine = null;
        var points = activeCircle.intersectionsWith(rootCircle.geometry);

        // Get squared distance from one point to cursor
        var dx = points[0].x - cursor.x;
        var dy = points[0].y - cursor.y;
        var d2 = dx*dx + dy*dy;

        // Check which point corresponds to the cursor and set fromAngle and toAngle accordingly
        if (d2 < 1e-10)
        {
            activeCircle.fromAngle = atan2(points[0].y - activeCircle.y, points[0].x - activeCircle.x);
            target = atan2(points[1].y - activeCircle.y, points[1].x - activeCircle.x);
        }
        else
        {
            activeCircle.fromAngle = atan2(points[1].y - activeCircle.y, points[1].x - activeCircle.x);
            target = atan2(points[0].y - activeCircle.y, points[0].x - activeCircle.x);
        }

        // Make sure the distance between fromAngle and toAngle is less than pi (otherwise we
        // might go around the circle in the wrong direction)
        if (target - activeCircle.fromAngle > pi)
            target -= 2*pi;
        else if (target - activeCircle.fromAngle < -pi)
            target += 2*pi;

        // Determine sense of movement
        direction = sign(target - activeCircle.fromAngle);

        activeCircle.toAngle = activeCircle.fromAngle;

        var newCircle = new Circle(
            activeCircle.x,
            activeCircle.y,
            activeCircle.r,
            activeCircle.type,
            activeCircle.fromAngle,
            target,
            activeCircle.color
        );

        affectedLeaves = rootCircle.insert(newCircle);
    }
    else
    {
        activeCircle.destroy();
        activeCircle = null;
        activeLine.toDistance = -1;
        target = 1;

        var newLine = new Line(
            activeLine.angle,
            activeLine.type,
            target,
            activeLine.color
        );

        affectedLeaves = rootCircle.insert(newLine);
    }

    cursorMoving = true;
}

// Takes the mouse event and the rectangle to normalise for
// Outputs object with x, y coordinates in [-1,1] with positive
// y pointing upwards.
function normaliseCursorCoordinates(event, rect)
{
    return {
        x: (2*(event.clientX - rect.left) / resolution - 1) / renderScale,
        y: (1 - 2*(event.clientY - rect.top) / resolution) / renderScale, // invert, to make positive y point upwards
    };
}

// Determines if cursor and mouse are sufficiently closely aligned
// to snap to a straight line. Parameters are the coordinates of the
// mouse.
function snapToLine(x, y) {
    if (!activeLine)
        return false;

    // The angle of the line from the cursor to the mouse.
    var pointedAngle = atan2(y - cursor.y, x - cursor.x);

    // There is a branch cut at an angle of +/- pi, which means
    // that if the two angles are really close, but one in the 2nd
    // and one in the third quadrant, their difference will erroneously
    // be about 2pi. To fix this, we modify the pointed angle accordingly.
    // We actually reduce the difference below pi/2, because an angle
    // difference of pi is also (anti)parallel.

    while (pointedAngle - activeLine.angle > pi/2)
        pointedAngle -= pi;
    while (pointedAngle - activeLine.angle < -pi/2)
        pointedAngle += pi;

    // Snap if we're less than 5 degrees away the line
    return abs(pointedAngle - activeLine.angle) < 2 * pi / 180;
}

// n is the number of samples to generate
function runMonteCarlo(n) {
    for (var i = 0; i < n; ++i)
    {
        // Generate points uniformly in coordinate range [-1,1]
        var x = Math.random()*2-1;
        var y = Math.random()*2-1;
        // Ignore points that are not inside the unit circle
        if (x*x + y*y <= 1)
            rootCircle.registerSample(x, y);
    }
}

function recalculateArea()
{
    var newArea = rootCircle.recalculateAreas();
    if (newArea - totalArea > 0.01)
    {
        totalArea = newArea;
        debugBox.find('#area').html((totalArea*100).toFixed());
    }
    if (debug) displayTree();
}

function displayTree()
{
    debugBox.find('#kdtree').html(rootCircle.toString().replace(/\n/g, '<br>'));
}

function CheckError(msg)
{
    var error = gl.getError();
    if (error !== 0)
    {
        var errMsg = "OpenGL error: " + error.toString(16);
        if (msg) { errMsg = msg + "</br>" + errMsg; }
        messageBox.html(errMsg);
    }
}
