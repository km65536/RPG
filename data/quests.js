/**
 * クエストデータ
 *
 * 新しいクエストを追加する方法:
 *  - QUEST_DATABASE にエントリを追加する
 *  - state: "unlocked" なら最初からクエストログで受託可能、
 *    "locked" + requires: "他のクエストID" なら、そのクエストが完了(completed)した時点で解放される
 *  - targetCount を指定すると main.js 側の progressQuest() で回数カウント方式になる
 *  - reward.exp / reward.gold / reward.items ([{id, count}]) は
 *    クエストログの「報酬を受け取る」ボタンを押した時に付与される
 *  - 進行条件そのもの (どの敵を倒したら進むか、どのNPCと話したら達成か) は
 *    main.js 側の該当箇所 (processWin, NPCの onTalk など) に個別に書く必要がある
 */

const QUEST_DATABASE = {
    intro: {
        id: "intro",
        title: "はじめてのお買い物",
        description: "町のNPC「おばあさん」に話しかけ、薬草を1個入手しよう。",
        state: "unlocked",
        reward: { exp: 50 }
    },
    visit_merchant: {
        id: "visit_merchant",
        title: "商店を訪ねよう",
        description: "町の商店に入り、主人に話しかけよう。",
        state: "unlocked",
        reward: { items: [{ id: "herb", count: 3 }] }
    },
    visit_blacksmith: {
        id: "visit_blacksmith",
        title: "鍛冶屋に挨拶しよう",
        description: "町の鍛冶場に入り、鍛冶屋に話しかけよう。",
        state: "unlocked",
        reward: { gold: 50, items: [{ id: "wood_sword", count: 1 }] }
    },
    extermination: {
        id: "extermination",
        title: "水辺の害虫駆除",
        description: "スライムを3匹倒して、生態を調査しよう。",
        targetCount: 3,
        currentCount: 0,
        state: "unlocked",
        reward: { exp: 80, gold: 40 }
    },
    hunt_wolves: {
        id: "hunt_wolves",
        title: "森の脅威",
        description: "野生のウルフを5匹討伐し、町の安全を守ろう。(「はじめてのお買い物」達成で解放)",
        targetCount: 5,
        currentCount: 0,
        state: "locked",
        requires: "intro",
        reward: { exp: 150, gold: 80, items: [{ id: "book_power_within", count: 1 }] }
    },
    dungeon_boss: {
        id: "dungeon_boss",
        title: "ダンジョンの奥へ",
        description: "洞窟の奥に潜むボスを討伐しよう。(「森の脅威」達成で解放)",
        state: "locked",
        requires: "hunt_wolves",
        reward: { gold: 200, items: [{ id: "book_holy_burst", count: 1 }] }
    }
};
