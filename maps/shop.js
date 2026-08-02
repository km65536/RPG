/**
 * maps/shop.js - 商店の中 (商人NPCがいる)
 */
window.MAP_DATA = window.MAP_DATA || {};

MAP_DATA.shop = {
    width: 10, height: 10,
    legend: {
        "W": { "type": "wall", "passable": false },
        "F": { "type": "floor", "passable": true },
        "E": { "type": "door", "passable": true, "portal": "outside:22,12" }
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