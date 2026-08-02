/**
 * maps/blacksmith.js - 鍛冶場の中 (鍛冶屋NPCがいる)
 */
window.MAP_DATA = window.MAP_DATA || {};

MAP_DATA.blacksmith = {
    width: 10, height: 10,
    legend: {
        "W": { "type": "wall", "passable": false },
        "F": { "type": "floor", "passable": true },
        "E": { "type": "door", "passable": true, "portal": "outside:8,23" }
    },
    layout: [
        "WWWWWWWWWW",
        "WFFFFFFFFW",
        "WFFFFFFFFW",
        "WFFFFFFFFW",
        "WFFFFFFFFW",
        "WFFFFFFFFW",
        "WFFFFFFFFW",
        "WFFFFFFFFW",
        "WWWWWEWWWW",
        "WWWWWWWWWW"
    ]
};