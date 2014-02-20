
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
        initialWalls: [],
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
        initialWalls: [],
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
        initialWalls: [],
        availableWalls: 2,
    },
];
