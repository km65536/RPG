/**
 * maps/outside.js - はじまりの町
 * 家・商店・鍛冶場は「屋根(2段)+壁(窓)+壁(扉)」の4段構成の建物として配置。
 * MAP_DATA は data/constants.js より後、main.js より前に読み込まれる前提。
 */
window.MAP_DATA = window.MAP_DATA || {};

MAP_DATA.outside = {
    width: 30, height: 30,
    legend: {
        "W": { "type": "wall", "passable": false },
        "G": { "type": "grass", "passable": true },
        "~": { "type": "water", "passable": false },
        "K": { "type": "cave_entrance", "passable": true, "portal": "dungeon:5,11" },

        "A": { "type": "roof_peak_house", "passable": false },
        "H": { "type": "roof_house", "passable": false },
        "J": { "type": "wall_house", "passable": false },
        "N": { "type": "window_house", "passable": false },
        "D": { "type": "door", "passable": true, "portal": "inside:5,7" },

        "B": { "type": "roof_peak_shop", "passable": false },
        "S": { "type": "roof_shop", "passable": false },
        "Q": { "type": "wall_shop", "passable": false },
        "M": { "type": "window_shop", "passable": false },
        "P": { "type": "door", "passable": true, "portal": "shop:5,7" },

        "Z": { "type": "roof_peak_blacksmith", "passable": false },
        "C": { "type": "roof_blacksmith", "passable": false },
        "X": { "type": "wall_blacksmith", "passable": false },
        "Y": { "type": "window_blacksmith", "passable": false },
        "T": { "type": "door", "passable": true, "portal": "blacksmith:5,7" }
    },
    layout: [
        "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGHHAHHGGGGGGGGGGGW",
        "WGGGGGGGGGGGGHHHHHGGGGGGGGGGGW",
        "WGGGGGGGGGGGGJNJNJGGGGGGGGGGGW",
        "WGGGGGGGGGGGGJJDJJGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGSSBSSGGGGW",
        "WGGGGGGGGGGGGGGGGGGGSSSSSGGGGW",
        "WGGGGGGGGGGGGGGGGGGGQMQMQGGGGW",
        "WGGGGGGGGGGGGGGGGGGGQQPQQGGGGW",
        "WGGGGKGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGG~~~~~~~~GGGW",
        "WGGGGGGGGGGGGGGGGG~~~~~~~~GGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGCCZCCGGGGGGGGGGGGGGGGGGW",
        "WGGGGGCCCCCGGGGGGGGGGGGGGGGGGW",
        "WGGGGGXYXYXGGGGGGGGGGGGGGGGGGW",
        "WGGGGGXXTXXGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WGGGGGGGGGGGGGGGGGGGGGGGGGGGGW",
        "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
    ]
};