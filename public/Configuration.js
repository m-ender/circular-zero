
var GameMode = {
    ClassicArcade: "classicArcade", // random levels, one enemy type
    VarietyArcade: "varietyArcade", // random levels, multiple enemy types
    Campaign: "campaign", // designed levels
};

var cursorRadius = 0.025;
var cursorSpeed = 1; // given in length units per second

var EnemyTypes = [
    { // The default enemy is always at index 0
        radius: 0.025,
        speed: 0.3, // given in length units per second
        level: 1 // this is used to count how many default
                 // enemies the other types are "worth"
    },
    { // A big but slow variant
        radius: 0.075,
        speed: 0.2,
        level: 2
    }, // A fast but small variant
    {
        radius: 0.01,
        speed: 1,
        level: 3
    }
];

// This setting is only used for arcade modes
var initialWalls = 10;
var wallsPerLevel = 5;

/** Campaign levels **/

var CampaignLevels = [
    { // Simple level with one enemy going up and down
        enemies: [
            {
                type: 0,
                x: 0,
                y: 0,
                angle: pi/2,
            }
        ],
        walls: [],
        availableWalls: 5,
    },
    { // Two enemies going diagonally
        enemies: [
            {
                type: 0,
                x: 0,
                y: 0,
                angle: pi/4,
            },
            {
                type: 0,
                x: 0,
                y: 0,
                angle: 3*pi/4,
            },
        ],
        walls: [],
        availableWalls: 5,
    },
    { // Two enemies going (roughly) around the circumference
        enemies: [
            {
                type: 0,
                x: 0,
                y: 1 - 2*EnemyTypes[0].radius,
                angle: pi,
            },
            {
                type: 0,
                x: 0,
                y: -1 + 2*EnemyTypes[0].radius,
                angle: 0,
            },
        ],
        walls: [],
        availableWalls: 2,
    },
    { // The Egg!
        enemies: function() {
            var r, phi;
            var result = [];
            for (var i = 0; i < 6; ++i)
            {
                r = (1 - EnemyTypes[0].radius) * 1/6 * i;
                phi = i * pi/12;
                result.push({
                    type: 0,
                    x: r*cos(phi),
                    y: r*sin(phi),
                    angle: phi,
                });
            }

            for (i = 0; i < 6; ++i)
            {
                r = (1 - EnemyTypes[0].radius) * 1/6 * (6 - i);
                phi = pi/2 + i * pi/12;
                result.push({
                    type: 0,
                    x: r*cos(phi),
                    y: r*sin(phi),
                    angle: phi + pi,
                });
            }

            return result;
        },
        walls: [],
        availableWalls: 20,
    },
    { // The whatever...
        enemies: function() {
            var result = [];
            for (var i = 0; i < 21; ++i)
            {
                result.push({
                    type: 0,
                    x: 0,
                    y: (-1 + i / 10) * (1 - 2*EnemyTypes[0].radius),
                    angle: 0,
                });
            }
            return result;
        },
        walls: [],
        availableWalls: 100,
    },
    { // Two worlds
        enemies: [
            {
                type: 1,
                x: -0.5,
                y: 0.5,
                angle: pi/3,
            },
            {
                type: 1,
                x: -0.5,
                y: -0.5,
                angle: -pi/3,
            },
            {
                type: 2,
                x: 0.5,
                y: 0.5,
                angle: 2*pi/3,
            },
            {
                type: 2,
                x: 0.5,
                y: -0.5,
                angle: -2*pi/3,
            },
        ],
        walls: [
            {
                type: Line,
                angle: pi/2,
            },
        ],
        availableWalls: 10,
    },
    { // Five worlds!
        enemies: [
            {
                type: 0,
                x: -1/sqrt(2),
                y: 0,
                angle: 0,
            },
            {
                type: 0,
                x: 1/sqrt(2),
                y: 0,
                angle: pi,
            },
            {
                type: 0,
                x: 0,
                y: 1/sqrt(2),
                angle: pi/2,
            },
            {
                type: 0,
                x: 0,
                y: -1/sqrt(2),
                angle: -pi/2,
            },
            {
                type: 0,
                x: -(sqrt(2) - 1 - EnemyTypes[0].radius) / 2,
                y: (sqrt(2) - 1 - EnemyTypes[0].radius) / 2,
                angle: -3*pi/4,
            },
            {
                type: 0,
                x: (sqrt(2) - 1 - EnemyTypes[0].radius) / 2,
                y: -(sqrt(2) - 1 - EnemyTypes[0].radius) / 2,
                angle: pi/4,
            },
        ],
        walls: [
            {
                type: Circle,
                x: -sqrt(2),
                y: 0,
                r: 1,
            },
            {
                type: Circle,
                x: sqrt(2),
                y: 0,
                r: 1,
            },
            {
                type: Circle,
                x: 0,
                y: -sqrt(2),
                r: 1,
            },
            {
                type: Circle,
                x: 0,
                y: sqrt(2),
                r: 1,
            },
        ],
        availableWalls: 10,
    }
];
