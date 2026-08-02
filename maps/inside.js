/**
 * maps/inside.js - 家の中 (プレイヤーの拠点)
 */
window.MAP_DATA = window.MAP_DATA || {};

MAP_DATA.inside = {
    width: 10, height: 10,
    legend: {
        "W": { "type": "wall", "passable": false },
        "F": { "type": "floor", "passable": true },
        "E": { "type": "door", "passable": true, "portal": "outside:15,8" }
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