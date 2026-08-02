/**
 * maps/dungeon.js - ダンジョン
 * 柱で区切られた小部屋が連なる洞窟。奥にボスが待つ。
 */
window.MAP_DATA = window.MAP_DATA || {};

MAP_DATA.dungeon = {
    width: 14, height: 14,
    legend: {
        "W": { "type": "wall", "passable": false },
        "F": { "type": "floor", "passable": true },
        "E": { "type": "door", "passable": true, "portal": "outside:5,13" }
    },
    layout: [
        "WWWWWWWWWWWWWW",
        "WFFFFFFFFFFFFW",
        "WFFWWFFFFWWFFW",
        "WFFWWFFFFWWFFW",
        "WFFFFFFFFFFFFW",
        "WFFWWWFFWWWFFW",
        "WFFWWWFFWWWFFW",
        "WFFFFFFFFFFFFW",
        "WFFWWFFFFWWFFW",
        "WFFWWFFFFWWFFW",
        "WFFFFFFFFFFFFW",
        "WFFFFFFFFFFFFW",
        "WWWWWEWWWWWWWW",
        "WWWWWWWWWWWWWW"
    ]
};
