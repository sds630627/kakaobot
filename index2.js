'use strict';

// index.js — 타짜봇 v3 (시즌제/가챠/업적/바카라/1:1주사위/은행/config.json)
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'users.json');
const MARKET_FILE = path.join(__dirname, 'market.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

const server = dgram.createSocket('udp4');

// ═══════════════════════════════════════════════════════
// 1. CONFIG 로드/저장
// ═══════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
    fees: { sutda: 10, blackjack: 5, baccarat: 8, numberGuess: 5, duel: 8 },
    sutda: { dealerDieMaxChance: 15 },
    gacha: {
        초급상자: { price: 100000, rates: { 일반: 75, 희귀: 20, 영웅: 4, 전설: 1, 신화: 0, 꽝: 0 } },
        중급상자: { price: 1000000, rates: { 일반: 50, 희귀: 30, 영웅: 15, 전설: 4, 신화: 0, 꽝: 1 } },
        고급상자: { price: 10000000, rates: { 일반: 25, 희귀: 35, 영웅: 28, 전설: 10, 신화: 1, 꽝: 1 } },
        영웅상자: { price: 100000000, rates: { 일반: 0, 희귀: 15, 영웅: 55, 전설: 25, 신화: 5, 꽝: 0 } },
        전설상자: { price: 1000000000, rates: { 일반: 0, 희귀: 0, 영웅: 25, 전설: 55, 신화: 20, 꽝: 0 } },
        신화상자: { price: 10000000000, rates: { 일반: 0, 희귀: 0, 영웅: 5, 전설: 35, 신화: 60, 꽝: 0 } }
    },
    coin: { updateIntervalMinutes: 10, maxChangePercent: 40 },
    loan: { maxRatio: 0.5, hourlyInterestRate: 5 },
    deposit: { graceMinutes: 20, hourlyInterestRate: 0.05 },
    employee: { taxRate: 20 },
    // Phase 2: 장비상자 (등급 고정 드랍, 부위만 랜덤)
    equipmentBox: {
        초급장비상자: { price: 50000 },
        중급장비상자: { price: 300000 },
        고급장비상자: { price: 2000000 },
        영웅장비상자: { price: 15000000 },
        전설장비상자: { price: 100000000 },
        신화장비상자: { price: 800000000 }
    },
    // Phase 2: 용병상자 (등급 고정, 해당 등급 파티원 지급)
    mercenaryBox: {
        초급용병상자: { price: 80000 },
        중급용병상자: { price: 500000 },
        고급용병상자: { price: 3000000 },
        영웅용병상자: { price: 20000000 },
        전설용병상자: { price: 150000000 },
        신화용병상자: { price: 1000000000 }
    },
    // 장비상자 개봉 시 부위별 드랍 확률(가중치)
    equipDropRate: { weapon: 20, armor: 20, shield: 20, ring: 40 },
    // 장비상점 (초급 등급만 판매)
    equipShop: { weapon: 1000, armor: 1000, shield: 2000, ring: 3000 },
    // 강화석 상자 (랜덤 수량)
    stoneBox: {
        초급강화석상자: { price: 30000,      rolls: [
            { amt: 1, weight: 50 }, { amt: 2, weight: 30 }, { amt: 3, weight: 15 }, { amt: 5, weight: 4 }, { amt: 10, weight: 1 }
        ]},
        중급강화석상자: { price: 200000,     rolls: [
            { amt: 5, weight: 45 }, { amt: 10, weight: 30 }, { amt: 20, weight: 15 }, { amt: 40, weight: 8 }, { amt: 80, weight: 2 }
        ]},
        고급강화석상자: { price: 1500000,    rolls: [
            { amt: 25, weight: 40 }, { amt: 50, weight: 30 }, { amt: 100, weight: 18 }, { amt: 200, weight: 9 }, { amt: 500, weight: 3 }
        ]},
        영웅강화석상자: { price: 12000000,   rolls: [
            { amt: 100, weight: 35 }, { amt: 200, weight: 30 }, { amt: 400, weight: 20 }, { amt: 800, weight: 12 }, { amt: 2000, weight: 3 }
        ]},
        전설강화석상자: { price: 100000000,  rolls: [
            { amt: 500, weight: 30 }, { amt: 1000, weight: 28 }, { amt: 2000, weight: 22 }, { amt: 5000, weight: 15 }, { amt: 10000, weight: 5 }
        ]}
    },
    // 소울 상자 (랜덤 수량)
    soulBox: {
        하급소울상자: { price: 500000,       rolls: [
            { amt: 1, weight: 55 }, { amt: 2, weight: 28 }, { amt: 3, weight: 12 }, { amt: 5, weight: 4 }, { amt: 10, weight: 1 }
        ]},
        중급소울상자: { price: 5000000,      rolls: [
            { amt: 5, weight: 45 }, { amt: 10, weight: 30 }, { amt: 20, weight: 16 }, { amt: 50, weight: 7 }, { amt: 100, weight: 2 }
        ]},
        상급소울상자: { price: 50000000,     rolls: [
            { amt: 30, weight: 40 }, { amt: 60, weight: 28 }, { amt: 120, weight: 20 }, { amt: 300, weight: 10 }, { amt: 700, weight: 2 }
        ]},
        영웅소울상자: { price: 500000000,    rolls: [
            { amt: 150, weight: 35 }, { amt: 300, weight: 30 }, { amt: 600, weight: 20 }, { amt: 1500, weight: 13 }, { amt: 3000, weight: 2 }
        ]},
        전설소울상자: { price: 5000000000,   rolls: [
            { amt: 800, weight: 30 }, { amt: 1500, weight: 28 }, { amt: 3000, weight: 22 }, { amt: 8000, weight: 15 }, { amt: 20000, weight: 5 }
        ]}
    },
    // Phase 3: 사냥터
    hunt: { minMinutes: 1, maxMinutes: 480, breakChance: 0 },
    newsAdmins: ['A', '박성빈'],
    quiz: {
        rewardPool: [
            { type: 'cash', value: 1000, weight: 30 },
            { type: 'cash', value: 5000, weight: 25 },
            { type: 'cash', value: 10000, weight: 20 },
            { type: 'cash', value: 50000, weight: 10 },
            { type: 'cash', value: 100000, weight: 7 },
            { type: 'box', value: '초급상자', weight: 5 },
            { type: 'box', value: '중급상자', weight: 2 },
            { type: 'box', value: '고급상자', weight: 0.8 },
            { type: 'box', value: '영웅상자', weight: 0.15 },
            { type: 'box', value: '전설상자', weight: 0.04 },
            { type: 'box', value: '신화상자', weight: 0.01 }
        ]
    }
};

let CONFIG = {};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            CONFIG = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), parsed);
        } else {
            CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            saveConfig();
        }
    } catch (e) {
        console.error('config.json 로드 실패:', e.message);
        CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, null, 2), 'utf8');
    } catch (e) {
        console.error('config.json 저장 실패:', e.message);
    }
}

function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function getConfigValue(dotPath) {
    const keys = dotPath.split('.');
    let obj = CONFIG;
    for (const k of keys) {
        if (obj == null || typeof obj !== 'object') return undefined;
        obj = obj[k];
    }
    return obj;
}

function setConfigValue(dotPath, value) {
    const keys = dotPath.split('.');
    let obj = CONFIG;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
        obj = obj[keys[i]];
    }
    const lastKey = keys[keys.length - 1];
    const num = parseFloat(value);
    obj[lastKey] = !isNaN(num) ? num : value;
    saveConfig();
}

// ═══════════════════════════════════════════════════════
// 2. 정적 데이터
// ═══════════════════════════════════════════════════════
const COIN_NAMES = ['성빈코인', '호근코인', '정재코인', '몰탈코인', '펭즈코인', '첨지코인'];
const ADMIN_NAMES = ['A', '박성빈'];

const MAN = 10000;
const EOK = 100000000;
const JO = 1000000000000;

// DEFAULT_LUXURY: RPG 개편으로 제거됨


const DEFAULT_COIN = {
    '성빈코인': { currentPrice: 1000, lastPrice: 1000, desc: '하이리스크 코인' },
    '호근코인': { currentPrice: 1000, lastPrice: 1000, desc: '안정 추구형 코인' },
    '정재코인': { currentPrice: 1000, lastPrice: 1000, desc: '상장폐지 위험 잡코인' },
    '몰탈코인': { currentPrice: 1000, lastPrice: 1000, desc: '신생 다크호스 코인' },
    '펭즈코인': { currentPrice: 1000, lastPrice: 1000, desc: '커뮤니티 밈 코인' },
    '첨지코인': { currentPrice: 1000, lastPrice: 1000, desc: '큰손이 움직이는 코인' }
};

// ─────────────────────────────────────────────
// 파티원(직원) 시스템 — RPG 컨셉으로 완전 재설계
// 등급별 캐릭터 라인업, 각자 고유 스킬 보유
// ─────────────────────────────────────────────
const PARTY_MEMBERS = {
    '김판돌':       { grade: '초급', baseSkillPower: 5,   skill: 'atkBuff',   skillDesc: '20% 확률 발동 - 다음 공격 데미지 +20%' },
    '나칼치':       { grade: '중급', baseSkillPower: 10,  skill: 'defBuff',   skillDesc: '20% 확률 발동 - 이번 턴 받는 데미지 -30%' },
    '도끼눈 최씨':  { grade: '고급', baseSkillPower: 20,  skill: 'heal',      skillDesc: '25% 확률 발동 - HP 15% 회복' },
    '흑룡 강':      { grade: '영웅', baseSkillPower: 40,  skill: 'critUp',    skillDesc: '25% 확률 발동 - 다음 공격 크리티컬 100%' },
    '백호 백작':    { grade: '전설', baseSkillPower: 80,  skill: 'pierce',    skillDesc: '30% 확률 발동 - 다음 공격 방어무시(관통)' },
    '무당벌레':     { grade: '신화', baseSkillPower: 150, skill: 'doubleAtk', skillDesc: '30% 확률 발동 - 이번 턴 2회 공격' },
    '검은 지배자':  { grade: '태초', baseSkillPower: 300, skill: 'ultimate',  skillDesc: '35% 확률 발동 - 강력한 진명해방 (관통+2회공격+회복)' }
};

// 용병 스킬 타입별 역할 라벨 (파티 편성 시 UI 안내용)
const ROLE_LABEL = {
    atkBuff:   '⚔️ 버퍼(공격)',
    defBuff:   '🛡️ 탱커(방어)',
    heal:      '💚 힐러',
    critUp:    '🎯 딜러(크리티컬)',
    pierce:    '🗡️ 딜러(관통)',
    doubleAtk: '⚡ 딜러(연타)',
    ultimate:  '🌌 올라운더'
};


// 공백 있는 파티원 이름을 args 배열에서 매칭
// 예: args = ['A', '검은', '지배자', '3'] → { name: '검은 지배자', restArgs: ['3'] }
function matchPartyMemberFromArgs(args, startIdx) {
    const memberNames = Object.keys(PARTY_MEMBERS);
    // 긴 이름부터 매칭 시도 (2단어 이름 우선)
    const sorted = memberNames.sort((a, b) => b.split(' ').length - a.split(' ').length);
    for (const name of sorted) {
        const parts = name.split(' ');
        const slice = args.slice(startIdx, startIdx + parts.length).join(' ');
        if (slice === name) {
            return { name, nextIdx: startIdx + parts.length };
        }
    }
    return null;
}

// 파티원 스킬 이름 로그용
const PARTY_SKILL_MESSAGES = {
    atkBuff:   (n) => `⚡ ${n}이(가) 나타나 공격력을 끌어올립니다!`,
    defBuff:   (n) => `🛡️ ${n}이(가) 방벽을 세워 피해를 줄입니다!`,
    heal:      (n) => `💚 ${n}이(가) 상처를 치유합니다!`,
    critUp:    (n) => `🎯 ${n}이(가) 급소를 노립니다! 크리티컬 확정!`,
    pierce:    (n) => `🗡️ ${n}이(가) 방어를 꿰뚫는 일격을 준비합니다!`,
    doubleAtk: (n) => `⚡⚡ ${n}이(가) 잔영을 만들며 연격을 시전합니다!`,
    ultimate:  (n) => `🌌 ${n}이(가) 진명해방! 세계가 무너집니다!`
};

// ─────────────────────────────────────────────
// Phase 2: 장비 시스템
// ─────────────────────────────────────────────
const EQUIP_GRADES = ['초급', '중급', '고급', '영웅', '전설', '신화', '태초'];
const EQUIP_BOX_GRADES = ['초급', '중급', '고급', '영웅', '전설', '신화']; // 태초는 상자로 뽑지 않음
const EQUIP_GRADE_EMOJI = { 초급: '⚪', 중급: '🟢', 고급: '🔵', 영웅: '🟣', 전설: '🟠', 신화: '🔴', 태초: '🌌' };

// 부위별 등급 기본 스탯
const WEAPON_ATK  = { 초급: 5,  중급: 15, 고급: 35, 영웅: 80,  전설: 150, 신화: 280, 태초: 500 };
const ARMOR_DEF   = { 초급: 3,  중급: 8,  고급: 20, 영웅: 45,  전설: 80,  신화: 130, 태초: 200 };
const ARMOR_HP    = { 초급: 30, 중급: 80, 고급: 180,영웅: 350, 전설: 550, 신화: 780, 태초: 1000 };
const SHIELD_DEF  = { 초급: 5,  중급: 15, 고급: 35, 영웅: 70,  전설: 130, 신화: 200, 태초: 300 };
const RING_BUDGET = { 초급: 4,  중급: 10, 고급: 25, 영웅: 55,  전설: 100, 신화: 180, 태초: 320 };

const SLOT_LABEL = { weapon: '🗡️ 무기', armor: '🛡️ 방어구', shield: '🔰 방패', ring1: '💍 반지1', ring2: '💍 반지2' };
const SLOT_ALIASES = {
    무기: 'weapon', weapon: 'weapon',
    방어구: 'armor', armor: 'armor',
    방패: 'shield', shield: 'shield',
    반지1: 'ring1', ring1: 'ring1',
    반지2: 'ring2', ring2: 'ring2',
    반지: 'ring' // 인벤/구매 시 부위타입으로만 쓰임(어느 반지칸이든 가능)
};

// 특수 옵션(효과) 풀 — 같은 부위/등급이라도 서로 다른 조합이 나오도록 함.
// value는 등급 인덱스(0~6)에 비례해 스케일링됨. 실제 전투(사냥/레이드) 계산에서 참조.
const EFFECT_POOL = [
    { id: 'crit',      label: '치명타 확률',   appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 2,  perGrade: 1.2, desc: v => `치명타 확률 +${v}%` },
    { id: 'critdmg',   label: '치명타 피해',   appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 8,  perGrade: 5,   desc: v => `치명타 피해 +${v}%` },
    { id: 'pierce',    label: '방어관통',      appliesTo: ['weapon'],                  unit: '%', baseVal: 3,  perGrade: 2.5, desc: v => `방어관통 +${v}%` },
    { id: 'bossdmg',   label: '보스전 데미지', appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 3,  perGrade: 2,   desc: v => `보스 상대 데미지 +${v}%` },
    { id: 'lifesteal', label: '흡혈',          appliesTo: ['weapon', 'ring'],          unit: '%', baseVal: 2,  perGrade: 1.5, desc: v => `공격 시 데미지의 ${v}% 흡혈` },
    { id: 'thorns',    label: '반격',          appliesTo: ['armor', 'shield'],         unit: '%', baseVal: 3,  perGrade: 2,   desc: v => `피격 시 ${v}% 데미지 반사` },
    { id: 'dodge',     label: '회피율',        appliesTo: ['armor', 'shield', 'ring'], unit: '%', baseVal: 1,  perGrade: 0.8, desc: v => `회피율 +${v}%` },
    { id: 'regen',     label: '재생',          appliesTo: ['armor', 'ring'],           unit: '%', baseVal: 1,  perGrade: 0.7, desc: v => `매 턴 최대체력의 ${v}% 회복` },
    { id: 'guard',     label: '철벽',          appliesTo: ['shield'],                  unit: '%', baseVal: 3,  perGrade: 2,   desc: v => `받는 피해 ${v}% 감소` },
    { id: 'proc',      label: '용병 발동률',   appliesTo: ['ring'],                    unit: '%', baseVal: 2,  perGrade: 1.5, desc: v => `용병 스킬 발동확률 +${v}%` },
    { id: 'mana',      label: '마력',          appliesTo: ['weapon', 'armor', 'ring'], unit: '',  baseVal: 5,  perGrade: 8,   desc: v => `최대 마력 +${v}` },
    { id: 'manaRegen', label: '마력회복',      appliesTo: ['ring', 'armor'],           unit: '',  baseVal: 1,  perGrade: 0.5, desc: v => `턴당 마력회복 +${v}` },
];
const EFFECT_ATTACH_CHANCE = 0.4; // 아이템 생성 시 특수옵션이 붙을 확률

function rollEquipmentEffect(slotType, grade) {
    if (Math.random() >= EFFECT_ATTACH_CHANCE) return null;
    const gradeIdx = Math.max(0, EQUIP_GRADES.indexOf(grade));
    const pool = EFFECT_POOL.filter(e => e.appliesTo.includes(slotType));
    if (pool.length === 0) return null;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const value = Math.round((picked.baseVal + picked.perGrade * gradeIdx) * 10) / 10;
    return { id: picked.id, label: picked.label, value, unit: picked.unit, desc: picked.desc(value) };
}

let EQUIP_ID_SEQ = 0;
function nextEquipId() {
    EQUIP_ID_SEQ += 1;
    return `eq${Date.now().toString(36)}${EQUIP_ID_SEQ}${Math.floor(Math.random()*1000)}`;
}

// slotType: 'weapon' | 'armor' | 'shield' | 'ring' (반지는 장착시 ring1/ring2 선택)
function createEquipmentItem(slotType, grade) {
    let atk = 0, def = 0, hp = 0, name = '';
    if (slotType === 'weapon') {
        atk = WEAPON_ATK[grade] || 0;
        name = `${grade} 무기`;
    } else if (slotType === 'armor') {
        def = ARMOR_DEF[grade] || 0;
        hp  = ARMOR_HP[grade] || 0;
        name = `${grade} 방어구`;
    } else if (slotType === 'shield') {
        def = SHIELD_DEF[grade] || 0;
        name = `${grade} 방패`;
    } else if (slotType === 'ring') {
        const pool = ['atk', 'def', 'hp'];
        const dual = Math.random() < 0.35;
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const picks = dual ? shuffled.slice(0, 2) : [shuffled[0]];
        const budget = RING_BUDGET[grade] || 0;
        const per = dual ? budget / 2 : budget;
        for (const stat of picks) {
            if (stat === 'atk') atk += Math.round(per);
            else if (stat === 'def') def += Math.round(per);
            else hp += Math.round(per * 5); // HP는 체감상 크게
        }
        const labelMap = { atk: '공격', def: '방어', hp: '체력' };
        name = `${grade} 반지(${picks.map(p => labelMap[p]).join('/')})`;
    }
    const effect = rollEquipmentEffect(slotType, grade);
    if (effect) name += ` [${effect.label}]`;
    return { id: nextEquipId(), slotType, grade, name, atk, def, hp, enhanceLevel: 0, broken: false, effect };
}

// 강화 적용 스탯 (레벨당 +15%). 파손된 장비는 수리 전까지 스탯이 0으로 취급됨.
function effectiveItemStat(item) {
    if (!item) return { atk: 0, def: 0, hp: 0 };
    if (item.broken) return { atk: 0, def: 0, hp: 0 };
    const mult = 1 + (item.enhanceLevel || 0) * 0.15;
    return {
        atk: Math.round((item.atk || 0) * mult),
        def: Math.round((item.def || 0) * mult),
        hp:  Math.round((item.hp  || 0) * mult)
    };
}

// 장비 한 줄 표시용 (통계 + 특수옵션 + 파손여부)
function formatEquipLine(it) {
    if (it.broken) return `💔[파손됨 — !장비수리 필요]`;
    const eff = effectiveItemStat(it);
    const parts = [
        eff.atk ? `공격+${eff.atk}` : null,
        eff.def ? `방어+${eff.def}` : null,
        eff.hp  ? `체력+${eff.hp}`  : null
    ].filter(Boolean);
    if (it.effect) parts.push(it.effect.desc);
    return parts.join(' ') || '(스탯 없음)';
}

// 강화 성공확률 (목표 레벨 1~10 기준, index 0 = +1강화) — 재료 불필요, 확률 하향
const ENHANCE_SUCCESS_RATE = [70, 60, 50, 40, 35, 28, 22, 16, 10, 5];
// +7강화(index 6)부터 실패 시 파괴 확률 적용 (보스전 파괴와 별개)
const ENHANCE_DESTROY_START_LEVEL = 7;
const ENHANCE_DESTROY_RATE = { 7: 20, 8: 35, 9: 50, 10: 70 };

const ENHANCE_GOLD_BASE  = { 초급: 5000,  중급: 20000, 고급: 80000,  영웅: 300000, 전설: 1200000, 신화: 5000000,  태초: 20000000 };
const ENHANCE_STONE_BASE = { 초급: 5,     중급: 10,    고급: 20,     영웅: 40,     전설: 80,      신화: 150,      태초: 300 };

function calcEnhanceCost(grade, targetLevel) {
    return {
        gold: (ENHANCE_GOLD_BASE[grade] || 5000) * targetLevel,
        stones: (ENHANCE_STONE_BASE[grade] || 5) * targetLevel
    };
}

// 장비상자/용병상자 개봉
function rollEquipmentBox(boxType) {
    const grade = boxType.replace('장비상자', '');
    if (!EQUIP_GRADES.includes(grade)) return null;
    const rates = CONFIG.equipDropRate || { weapon: 20, armor: 20, shield: 20, ring: 40 };
    const total = Object.values(rates).reduce((s, v) => s + v, 0);
    let r = Math.random() * total;
    let slotType = 'weapon';
    for (const [k, w] of Object.entries(rates)) {
        if (r < w) { slotType = k; break; }
        r -= w;
    }
    return createEquipmentItem(slotType, grade);
}

const MERCENARY_BONUS_RATE = 0.01; // % — 상자 등급 용병은 항상 확정, 그 위 등급 용병이 추가로 나올 확률
function rollMercenaryBox(boxType) {
    const grade = boxType.replace('용병상자', '');
    const gradeIdx = EQUIP_GRADES.indexOf(grade);
    const nameOf = (g) => Object.keys(PARTY_MEMBERS).find(n => PARTY_MEMBERS[n].grade === g);
    const base = nameOf(grade);
    if (!base) return null;
    let bonus = null;
    if (gradeIdx >= 0 && gradeIdx < EQUIP_GRADES.length - 1) {
        if (Math.random() * 100 < MERCENARY_BONUS_RATE) {
            bonus = nameOf(EQUIP_GRADES[gradeIdx + 1]);
        }
    }
    return { base, bonus };
}

// 판매가 (등급/부위 기준 골드 환산)
const SELL_PRICE_BASE = { 초급: 2000, 중급: 8000, 고급: 30000, 영웅: 100000, 전설: 400000, 신화: 1500000, 태초: 6000000 };
function calcSellPrice(item) {
    const base = SELL_PRICE_BASE[item.grade] || 1000;
    const enhanceBonus = 1 + (item.enhanceLevel || 0) * 0.2;
    return Math.floor(base * enhanceBonus);
}

// 장비 수리비 (등급 기준)
const REPAIR_GOLD_BASE = { 초급: 3000, 중급: 12000, 고급: 50000, 영웅: 200000, 전설: 800000, 신화: 3000000, 태초: 12000000 };
function calcRepairCost(grade) {
    return REPAIR_GOLD_BASE[grade] || 3000;
}

// 강화석 수량 → 등급 표현
const STONE_GRADE_LABELS = [
    { min: 10000, label: '전설강화석 ×', div: 10000 },
    { min: 500,  label: '영웅강화석 ×', div: 500  },
    { min: 100,  label: '고급강화석 ×', div: 100  },
    { min: 25,   label: '중급강화석 ×', div: 25   },
    { min: 1,    label: '초급강화석 ×', div: 1    },
];
function stoneLabel(amt) {
    for (const g of STONE_GRADE_LABELS) {
        if (amt >= g.min) {
            const n = (amt / g.div).toFixed(1).replace(/\.0$/, '');
            return `${g.label}${n} (${amt.toLocaleString()}개)`;
        }
    }
    return `${amt}개`;
}

// 가중치 기반 랜덤 롤
function weightedRoll(rolls) {
    const total = rolls.reduce((s, r) => s + r.weight, 0);
    let r = Math.random() * total;
    for (const roll of rolls) {
        if (r < roll.weight) return roll.amt;
        r -= roll.weight;
    }
    return rolls[rolls.length - 1].amt;
}



// 전투력 계산 (스탯랭킹과 동일 공식: 공격x2 + 방어x3 + HPx0.5)
function calcCombatPower(stat) {
    return Math.floor((stat.atk || 0) * 2 + (stat.def || 0) * 3 + (stat.maxHp || stat.hp || 0) * 0.5);
}

// ─────────────────────────────────────────────
// Phase 3: 사냥터
// ─────────────────────────────────────────────
const HUNTING_GROUNDS = [
    { name: '뒷산',        grade: '초급', recommendedPower: 100,    minPower: 30,     goldMin: 500,     goldMax: 2000,     stoneMin: 1,   stoneMax: 3 },
    { name: '어두운 숲',   grade: '중급', recommendedPower: 400,    minPower: 150,    goldMin: 2000,    goldMax: 8000,     stoneMin: 2,   stoneMax: 6 },
    { name: '폐광',        grade: '고급', recommendedPower: 1500,   minPower: 600,    goldMin: 8000,    goldMax: 30000,    stoneMin: 5,   stoneMax: 15 },
    { name: '얼음 동굴',   grade: '영웅', recommendedPower: 6000,   minPower: 2500,   goldMin: 30000,   goldMax: 120000,   stoneMin: 12,  stoneMax: 35 },
    { name: '용의 둥지',   grade: '전설', recommendedPower: 25000,  minPower: 10000,  goldMin: 120000,  goldMax: 500000,   stoneMin: 30,  stoneMax: 90 },
    { name: '천공의 섬',   grade: '신화', recommendedPower: 100000, minPower: 40000,  goldMin: 500000,  goldMax: 2000000,  stoneMin: 80,  stoneMax: 250 },
    { name: '혼돈의 균열', grade: '태초', recommendedPower: 500000, minPower: 200000, goldMin: 2000000, goldMax: 8000000,  stoneMin: 200, stoneMax: 600 }
];

function getHuntingGround(name) {
    return HUNTING_GROUNDS.find(h => h.name === name) || null;
}

// 전투력 미달 → 0%, 권장치 이상 → 최대 95%
function calcHuntSuccessRate(userPower, ground) {
    if (userPower < ground.minPower) return 0;
    const ratio = userPower / ground.recommendedPower;
    const rate = 50 + (ratio - 1) * 50;
    return Math.min(95, Math.max(1, Math.round(rate)));
}

// 진행 중인 사냥 세션 (메모리)
// huntSessions — 서버 재시작 복구를 위해 메모리+DB 혼용
// user.activeHunt: { groundName, startedAt, power } — DB 저장
// 시작 시 user.activeHunt 있으면 자동 유효 (추가 메모리 구조 불필요)
const huntSessions = {}; // 호환용 (하위 코드에서 참조 시 fallback)

// 사냥터별 전리품 테이블 (시간 당 평균 기대값, 실제는 확률적으로 분배)
// 특수 드랍: 등급 맞는 장비상자, 용병상자, 강화석
const HUNT_LOOT_EXTRA = {
    '뒷산':       [ { type: 'box', name: '초급장비상자', chance: 3 }, { type: 'box', name: '초급용병상자', chance: 2 }, { type: 'spell', tier: 1, chance: 5 } ],
    '어두운 숲':  [ { type: 'box', name: '중급장비상자', chance: 2 }, { type: 'box', name: '중급용병상자', chance: 1 }, { type: 'spell', tier: 1, chance: 8 } ],
    '폐광':       [ { type: 'box', name: '고급장비상자', chance: 2 }, { type: 'box', name: '중급용병상자', chance: 3 }, { type: 'stones', amount: [5,15], chance: 20 }, { type: 'spell', tier: 1, chance: 10 }, { type: 'spell', tier: 2, chance: 3 } ],
    '얼음 동굴':  [ { type: 'box', name: '영웅장비상자', chance: 1 }, { type: 'box', name: '고급용병상자', chance: 2 }, { type: 'stones', amount: [10,30], chance: 30 }, { type: 'spell', tier: 2, chance: 5 } ],
    '용의 둥지':  [ { type: 'box', name: '전설장비상자', chance: 1 }, { type: 'box', name: '영웅용병상자', chance: 1 }, { type: 'stones', amount: [20,60], chance: 40 }, { type: 'souls', amount: [1,3], chance: 10 }, { type: 'spell', tier: 2, chance: 8 }, { type: 'spell', tier: 3, chance: 2 } ],
    '천공의 섬':  [ { type: 'box', name: '신화장비상자', chance: 1 }, { type: 'box', name: '전설용병상자', chance: 1 }, { type: 'stones', amount: [50,150], chance: 50 }, { type: 'souls', amount: [2,8], chance: 15 }, { type: 'spell', tier: 3, chance: 4 } ],
    '혼돈의 균열':[ { type: 'box', name: '신화용병상자', chance: 1 }, { type: 'stones', amount: [100,300], chance: 60 }, { type: 'souls', amount: [5,20], chance: 20 }, { type: 'spell', tier: 3, chance: 6 }, { type: 'spell', tier: 4, chance: 1 } ]
};
// 사냥터 드랍: tier에 맞는 랜덤 마법 1종
function rollSpellDrop(tier) {
    const pool = MAGIC_BOOKS.filter(m => m.tier === tier);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
}

// 사냥 종료 전리품 계산 (경과 시간 기반, 전투력이 높을수록 효율 증가)
function calcHuntLoot(ground, elapsedMin, userPower) {
    const hours = elapsedMin / 60;
    const effMult = Math.min(3.0, Math.max(0.3, userPower / ground.recommendedPower));
    const loot = { gold: 0, stones: 0, souls: 0, boxes: {} };

    // 기본 골드/강화석 (시간당 평균의 랜덤 배율)
    const goldPerHour = (ground.goldMin + ground.goldMax) / 2 * effMult;
    const stonesPerHour = (ground.stoneMin + ground.stoneMax) / 2 * effMult;
    loot.gold  = Math.floor(goldPerHour  * hours * (0.8 + Math.random() * 0.4));
    loot.stones = Math.floor(stonesPerHour * hours * (0.8 + Math.random() * 0.4));

    // 특수 드랍 (시간당 chance% 확률로 1개씩, 최소 보장 없음)
    const extras = HUNT_LOOT_EXTRA[ground.name] || [];
    for (const ex of extras) {
        const rolls = Math.floor(hours) + (Math.random() < (hours % 1) ? 1 : 0);
        for (let i = 0; i < Math.max(1, rolls); i++) {
            if (Math.random() * 100 < ex.chance) {
                if (ex.type === 'box') {
                    loot.boxes[ex.name] = (loot.boxes[ex.name] || 0) + 1;
                } else if (ex.type === 'stones') {
                    loot.stones += Math.floor(ex.amount[0] + Math.random() * (ex.amount[1] - ex.amount[0]));
                } else if (ex.type === 'souls') {
                    loot.souls += Math.floor(ex.amount[0] + Math.random() * (ex.amount[1] - ex.amount[0]));
                } else if (ex.type === 'spell') {
                    const spellId = rollSpellDrop(ex.tier);
                    if (spellId) { if (!loot.spells) loot.spells = []; loot.spells.push(spellId); }
                }
            }
        }
    }
    return loot;
}

// ─────────────────────────────────────────────
// Phase 4: 레이드 보스
// ─────────────────────────────────────────────
const RAID_BOSSES = [
    {
        name: '킹 슬라임', grade: '초급', recommendedPower: 200, minPower: 60,
        maxHp: 500, atk: 12, def: 3,
        gold: 5000, stones: 5, souls: 1,
        enrageHp: 0.3, enrageAtkMult: 1.8,
        desc: '거대한 젤리 덩어리. 작은 슬라임들을 흡수해 힘을 키웠다.'
    },
    {
        name: '숲의 수호자', grade: '중급', recommendedPower: 800, minPower: 300,
        maxHp: 1500, atk: 30, def: 10,
        gold: 20000, stones: 15, souls: 3,
        enrageHp: 0.3, enrageAtkMult: 2.0,
        desc: '고대 숲을 지키는 정령. 분노하면 자연의 힘을 해방한다.'
    },
    {
        name: '철갑 골렘', grade: '고급', recommendedPower: 3000, minPower: 1200,
        maxHp: 5000, atk: 70, def: 30,
        gold: 80000, stones: 40, souls: 8,
        enrageHp: 0.25, enrageAtkMult: 2.2,
        desc: '폐광에서 발굴된 고대 전쟁 병기. 분노 시 핵심 코어가 폭발한다.'
    },
    {
        name: '빙하 용', grade: '영웅', recommendedPower: 12000, minPower: 5000,
        maxHp: 15000, atk: 180, def: 70,
        gold: 300000, stones: 100, souls: 20,
        enrageHp: 0.25, enrageAtkMult: 2.5,
        desc: '얼음 동굴의 지배자. 광폭화하면 절대영도 브레스를 쏟아낸다.'
    },
    {
        name: '용암 군주', grade: '전설', recommendedPower: 50000, minPower: 20000,
        maxHp: 50000, atk: 500, def: 150,
        gold: 1000000, stones: 250, souls: 50,
        enrageHp: 0.3, enrageAtkMult: 2.5,
        desc: '용의 둥지 깊숙이 군림하는 불의 지배자.'
    },
    {
        name: '천공의 군주', grade: '신화', recommendedPower: 200000, minPower: 80000,
        maxHp: 200000, atk: 1500, def: 400,
        gold: 5000000, stones: 600, souls: 120,
        enrageHp: 0.3, enrageAtkMult: 3.0,
        desc: '하늘 위 섬에서 세계를 내려다보는 존재.'
    },
    {
        name: '혼돈의 지배자', grade: '태초', recommendedPower: 1000000, minPower: 400000,
        maxHp: 1000000, atk: 5000, def: 1000,
        gold: 30000000, stones: 2000, souls: 500,
        enrageHp: 0.3, enrageAtkMult: 3.5,
        desc: '모든 것의 근원이자 끝. 세계의 질서를 파괴하려 한다.'
    }
];

// 진행 중인 레이드 세션 (메모리 상 관리, 서버 재시작 시 초기화)
const raidSessions = {}; // roomId -> session

function getRaidBoss(name) {
    return RAID_BOSSES.find(b => b.name === name) || null;
}

// 파티원 스킬 레이드 적용 (전투 중 발동)
function applyPartySkillsRaid(user, state) {
    const effects = { atkMult: 1, defMult: 1, healRatio: 0, crit: false, pierce: false, doubleAtk: false, ultimate: false };
    const procBonus = getEquipmentEffectValue(user, 'proc') / 100; // 용병스킬발동률 옵션 합산
    for (const name of (user.activeParty || [])) {
        const info = PARTY_MEMBERS[name];
        if (!info) continue;
        const p = user.partyMembers[name];
        const baseRate = { atkBuff: 20, defBuff: 20, heal: 25, critUp: 25, pierce: 30, doubleAtk: 30, ultimate: 35 }[info.skill] || 20;
        const rate = Math.min(95, baseRate + procBonus * 100);
        if (Math.random() * 100 < rate) {
            const lvBonus = 1 + (p.level || 0) * 0.05;
            switch (info.skill) {
                case 'atkBuff':   effects.atkMult  += 0.2 * lvBonus; break;
                case 'defBuff':   effects.defMult  += 0.3 * lvBonus; break;
                case 'heal':      effects.healRatio += 0.15 * lvBonus; break;
                case 'critUp':    effects.crit      = true; break;
                case 'pierce':    effects.pierce    = true; break;
                case 'doubleAtk': effects.doubleAtk = true; break;
                case 'ultimate':  effects.ultimate  = true; break;
            }
        }
    }
    return effects;
}

// 장비 특수옵션 값 합산
function getEquipmentEffectValue(user, effectId) {
    if (!user || !user.equipment) return 0;
    let total = 0;
    for (const slot of ['weapon','armor','shield','ring1','ring2']) {
        const it = user.equipment[slot];
        if (it && !it.broken && it.effect && it.effect.id === effectId) {
            total += Number(it.effect.value) || 0;
        }
    }
    return total;
}

// 보스 패턴 테이블 — 각 패턴은 '예고' 메시지와 '올바른 반응' 액션을 가짐
// 플레이어가 올바른 액션을 선택하면 보너스, 틀리면 추가 피해
const BOSS_PATTERNS = [
    {
        id: 'crush',
        announce: '💥 보스가 강력한 분쇄 공격을 준비합니다!',
        counter: '방어',
        wrongPenalty: 1.5,
        counterBonus: 0.5,
        counterAttackMult: 1.0,
    },
    {
        id: 'weak',
        announce: '🎯 보스가 방어를 낮추고 약점을 노출합니다!',
        counter: '강공',
        wrongPenalty: 1.0,
        counterBonus: 1.0,
        counterAttackMult: 2.2,
    },
    {
        id: 'heal',
        announce: '💉 보스에게서 회복의 기운이 느껴집니다!',
        counter: '방해',
        wrongPenalty: 0,
        counterBonus: 1.0,
        counterAttackMult: 1.5,
        special: 'blockHeal',
    },
    {
        id: 'charge',
        announce: '⚡ 보스가 땅을 박차며 빠르게 돌진합니다!',
        counter: '회피',
        wrongPenalty: 2.0,
        counterBonus: 0.0,
        counterAttackMult: 1.3,
    },
];

// 다음 보스 패턴 뽑기
function rollBossPattern() {
    return BOSS_PATTERNS[Math.floor(Math.random() * BOSS_PATTERNS.length)];
}


function hpBar(current, max, enraged = false) {
    const cur = Math.max(0, current);
    const ratio = max > 0 ? cur / max : 0;
    const pct = Math.round(ratio * 100);
    const BARS = 20;
    const filled = Math.round(ratio * BARS);
    const empty  = BARS - filled;
    // 체력 구간별 블록 색
    const fillChar = enraged ? '🟥' : pct > 50 ? '🟩' : pct > 25 ? '🟨' : '🟥';
    const emptyChar = '⬜';
    // 블록 이모지가 2바이트라 20개면 너무 길 수 있음 → 10칸 사용
    const B = 10;
    const f = Math.round(ratio * B);
    const e = B - f;
    const bar = fillChar.repeat(f) + emptyChar.repeat(e);
    return `${bar} ${pct}% (${cur.toLocaleString()}/${max.toLocaleString()})`;
}

// 레이드 한 턴 전투 계산
function raidTurn(user, session, statIn, action) {
    let stat = { ...statIn }; // mutable copy
    const boss = session.boss;
    const log = [];

    const critChance   = getEquipmentEffectValue(user, 'crit');
    const critDmgBonus = getEquipmentEffectValue(user, 'critdmg') / 100;
    const piercePct    = getEquipmentEffectValue(user, 'pierce') / 100;
    const bossDmgBonus = getEquipmentEffectValue(user, 'bossdmg') / 100;
    const lifestealPct = getEquipmentEffectValue(user, 'lifesteal') / 100;
    const thornsPct    = getEquipmentEffectValue(user, 'thorns') / 100;
    const dodgePct     = getEquipmentEffectValue(user, 'dodge');
    const regenPct     = getEquipmentEffectValue(user, 'regen');
    const guardPct     = getEquipmentEffectValue(user, 'guard') / 100;

    // 턴 시작: debuff 틱 처리 (화상 등)
    if (!session.bossDebuffs) session.bossDebuffs = [];
    tickBossDebuffs(session, log);
    if (session.bossHp <= 0) return { log, result: 'win' };

    // 마력 자연 회복 (턴당 장비 보너스 + 기본 1)
    const { regen: manaRegen } = calcManaFromEquip(user.equipment);
    session.mana = Math.min(session.maxMana, (session.mana || 0) + 1 + manaRegen);

    // 배리어 상태면 피해 감소
    if (session.playerBarrier > 0) session.playerBarrier--;

    // 패턴 대응 판정
    const pattern = session.pendingPattern || null;
    let patternHit = false;
    let actionAtkMult = 1.0;
    let bossDmgMult = 1.0;
    let blockHeal = false;
    let forceEvade = false;

    if (pattern) {
        patternHit = (action === pattern.counter);
        if (patternHit) {
            actionAtkMult = pattern.counterAttackMult || 1.0;
            bossDmgMult = pattern.counterBonus ?? 1.0;
            if (pattern.special === 'blockHeal') blockHeal = true;
            if (pattern.counter === '회피') forceEvade = true;
            log.push(`✅ 패턴 대응 성공! [${action}]`);
        } else {
            bossDmgMult = pattern.wrongPenalty ?? 1.0;
            log.push(`❌ 패턴 대응 실패! (권장: ${pattern.counter}) → 보스 피해 ×${pattern.wrongPenalty}`);
        }
        session.pendingPattern = null;
    }

    // 파티원 스킬 발동
    const skills = applyPartySkillsRaid(user, session);
    if (skills.atkMult > 1)    log.push(`⚡ 용병 버프: 공격력 ×${skills.atkMult.toFixed(2)}`);
    if (skills.defMult > 1)    log.push(`🛡️ 용병 방어: 피해 감소`);
    if (skills.crit)           log.push(`🎯 용병 크리티컬 확정!`);
    if (skills.pierce)         log.push(`🗡️ 용병 관통 발동!`);
    if (skills.doubleAtk)      log.push(`⚡⚡ 용병 연격 발동!`);
    const hasUltimateAwaken = (user.skills || []).includes('진명해방 각성');
    if (skills.ultimate) {
        skills.crit = true; skills.pierce = true; skills.doubleAtk = true;
        skills.healRatio += hasUltimateAwaken ? 0.2 : 0.1;
        log.push(`🌌 진명해방!${hasUltimateAwaken ? ' (각성+)' : ''}`);
    }

    // 스킬북: 드래곤 블러드 — 매 턴 회복 + 공격력 보너스
    const hasDragonBlood = (user.skills || []).includes('용의 피');
    if (hasDragonBlood) {
        const dbRegen = Math.floor(session.maxHp * 0.02);
        session.hp = Math.min(session.maxHp, session.hp + dbRegen);
        stat = { ...stat, atk: stat.atk + 50 };
        log.push(`🐉 용의 피: +${dbRegen} HP`);
    }

    // HP 회복(재생 옵션)
    if (regenPct > 0) {
        const regen = Math.floor(session.maxHp * regenPct / 100);
        session.hp = Math.min(session.maxHp, session.hp + regen);
        log.push(`💧 재생: +${regen} HP`);
    }

    // 플레이어 공격 (강공 액션 시 추가 배율)
    const isCrit = session.nextCritGuaranteed || skills.crit || Math.random() * 100 < critChance;
    if (session.nextCritGuaranteed) session.nextCritGuaranteed = false;
    // 디버프 적용: 저주(방어력 감소) / 관통 / 전기
    const hasPierce100 = session.bossDebuffs.some(d => d.type === 'pierce100');
    const hasElectrify = session.bossDebuffs.some(d => d.type === 'electrify');
    const defDownPct   = session.bossDebuffs.filter(d => d.type === 'defDown').reduce((s,d) => s+d.value, 0) / 100;
    const effDef = (hasPierce100 || hasElectrify) ? 0 :
        Math.max(0, boss.def * (1 - piercePct - defDownPct) * (1 - (skills.pierce ? 1 : 0)));
    let atkStat = stat.atk * skills.atkMult * actionAtkMult;
    // 스킬북: 강철 의지
    const hasLastStand = (user.skills || []).includes('강철 의지');
    if (hasLastStand && session.hp <= session.maxHp * 0.2) {
        atkStat *= 1.3;
        log.push(`🔥 강철 의지 발동!`);
    }
    let rawDmg = Math.max(1, atkStat - effDef);
    if (isCrit) rawDmg *= (1.5 + critDmgBonus);
    rawDmg *= (1 + bossDmgBonus);
    const hasExtraHit = (user.skills || []).includes('연속타');
    const extraHit = hasExtraHit && Math.random() * 100 < 15;
    const hitCount = (skills.doubleAtk ? 2 : 1) + (extraHit ? 1 : 0);
    let totalDmg = Math.floor(rawDmg) * hitCount;
    session.bossHp = Math.max(0, session.bossHp - totalDmg);
    log.push(`🗡️ ${totalDmg} 피해${isCrit ? ' (크리!)' : ''}${hitCount > 1 ? ` (${hitCount}타)` : ''}${actionAtkMult > 1 ? ` [${action} ×${actionAtkMult}]` : ''}`);

    // 흡혈
    if (lifestealPct > 0 && totalDmg > 0) {
        const heal = Math.floor(totalDmg * lifestealPct);
        session.hp = Math.min(session.maxHp, session.hp + heal);
        log.push(`🩸 흡혈: +${heal} HP`);
    }
    // 파티 힐
    if (skills.healRatio > 0) {
        const heal = Math.floor(session.maxHp * skills.healRatio);
        session.hp = Math.min(session.maxHp, session.hp + heal);
        log.push(`💚 힐: +${heal} HP`);
    }

    if (session.bossHp <= 0) return { log, result: 'win' };

    // 보스 광폭화 확인
    const enrageThreshold = Math.floor(boss.maxHp * boss.enrageHp);
    if (session.bossHp <= enrageThreshold && !session.enraged) {
        session.enraged = true;
        log.push(`💢 [광폭화!!] ${boss.name} 이(가) 분노했습니다! 공격력 ×${boss.enrageAtkMult}`);
    }

    // 보스 회복 시도 (패턴 방해 성공 시 차단)
    if (!blockHeal && session.bossHp < boss.maxHp * 0.4 && Math.random() < 0.08) {
        const bossHeal = Math.floor(boss.maxHp * 0.05);
        session.bossHp = Math.min(boss.maxHp, session.bossHp + bossHeal);
        log.push(`💉 보스 회복: +${bossHeal} HP`);
    } else if (blockHeal) {
        log.push(`🚫 방해 성공! 보스 회복 차단`);
    }

    // 보스 공격 (회피 패턴 대응 성공 시 완전 회피)
    const isFrozen = session.bossDebuffs.some(d => d.type === 'freeze');
    const slowPct  = session.bossDebuffs.filter(d => d.type === 'slow').reduce((s,d) => s+d.value, 0) / 100;
    if (isFrozen) {
        log.push(`❄️ 빙결! 보스의 공격이 봉인되었습니다.`);
    } else if (forceEvade) {
        log.push(`💨 완전 회피 성공!`);
    } else if (dodgePct > 0 && Math.random() * 100 < dodgePct) {
        log.push(`💨 회피 성공!`);
    } else {
        const bossAtk = Math.floor(boss.atk * (session.enraged ? boss.enrageAtkMult : 1) * (1 - slowPct));
        const damageReduction = guardPct + (1 - 1 / Math.max(1, skills.defMult));
        let bossDmg = Math.max(1, Math.floor(bossAtk * bossDmgMult * (1 - Math.min(0.8, damageReduction))));
        // 방어 자세
        if (action === '방어') { bossDmg = Math.floor(bossDmg * 0.6); log.push(`🛡️ 방어 자세: 피해 40% 감소`); }
        // 배리어
        if (session.playerBarrier > 0) { bossDmg = Math.floor(bossDmg * 0.5); log.push(`✨ 배리어: 피해 50% 감소`); }
        session.hp -= bossDmg;
        log.push(`👹 보스: ${bossDmg} 피해`);
        // 반격(가시)
        if (thornsPct > 0) {
            const thorns = Math.floor(bossAtk * thornsPct);
            session.bossHp = Math.max(0, session.bossHp - thorns);
            log.push(`🌵 반격: 보스에게 ${thorns} 피해`);
            if (session.bossHp <= 0) return { log, result: 'win' };
        }
    }

    if (session.hp <= 0) return { log, result: 'lose' };

    // 다음 턴 보스 패턴 예고 (25% 확률)
    if (Math.random() < 0.35) {
        session.pendingPattern = rollBossPattern();
        log.push(`\n⚠️ 예고: ${session.pendingPattern.announce}`);
    }

    return { log, result: 'continue' };
}

// ─────────────────────────────────────────────
// Phase 5: 스킬북 시스템
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 마력(MP) + 마법 시스템
// ─────────────────────────────────────────────
// 마법서 목록 — 10개 모이면 자동으로 다음 단계로 합성
const MAGIC_BOOKS = [
    // ── 화염 계열 ──────────────────────────────────────
    { id: 'fireball',     name: '파이어볼',     tier: 1, element: '🔥', mana: 5,   dmgMult: 1.4, effect: null,          evolves: 'flame_burst',    desc: '화염 구체를 발사한다.', cost: { souls: 3,  gold: 200000 } },
    { id: 'flame_burst',  name: '플레임 버스트', tier: 2, element: '🔥', mana: 12,  dmgMult: 1.9, effect: 'burn',        evolves: 'inferno',        desc: '화염이 폭발하며 화상을 입힌다. (2턴 추가 피해)', cost: { souls: 10, gold: 1000000 } },
    { id: 'inferno',      name: '인페르노',      tier: 3, element: '🔥', mana: 25,  dmgMult: 3.0, effect: 'burn_heavy',  evolves: 'meteor',         desc: '대규모 화염 폭풍. 3턴간 강한 화상.', cost: { souls: 30, gold: 5000000 } },
    { id: 'meteor',       name: '메테오',        tier: 4, element: '🔥', mana: 50,  dmgMult: 5.0, effect: 'stun',        evolves: null,             desc: '하늘에서 운석을 소환. 기절 30%.', cost: { souls: 80, gold: 20000000 } },
    // ── 냉기 계열 ──────────────────────────────────────
    { id: 'ice_shard',    name: '아이스 샤드',   tier: 1, element: '❄️', mana: 5,   dmgMult: 1.3, effect: 'slow',        evolves: 'blizzard',       desc: '얼음 파편으로 적의 속도를 낮춘다. (보스 공격력 -10%)', cost: { souls: 3,  gold: 200000 } },
    { id: 'blizzard',     name: '블리자드',      tier: 2, element: '❄️', mana: 15,  dmgMult: 2.2, effect: 'freeze',      evolves: 'glacial_spike',  desc: '눈보라로 1턴 적을 얼린다. (다음 턴 보스 피해 무효)', cost: { souls: 12, gold: 1500000 } },
    { id: 'glacial_spike',name: '글라시얼 스파이크', tier: 3, element: '❄️', mana: 30, dmgMult: 3.5, effect: 'freeze_heavy', evolves: 'absolute_zero', desc: '거대한 얼음 기둥으로 관통. 방어 무시.', cost: { souls: 40, gold: 8000000 } },
    { id: 'absolute_zero',name: '절대영도',      tier: 4, element: '❄️', mana: 60,  dmgMult: 6.0, effect: 'full_freeze',  evolves: null,            desc: '모든 것을 얼린다. 2턴간 보스 공격 봉인.', cost: { souls: 100, gold: 40000000 } },
    // ── 번개 계열 ──────────────────────────────────────
    { id: 'lightning',    name: '라이트닝',      tier: 1, element: '⚡', mana: 6,   dmgMult: 1.5, effect: null,          evolves: 'chain_lightning',desc: '번개를 발사한다.', cost: { souls: 3,  gold: 200000 } },
    { id: 'chain_lightning',name: '체인 라이트닝', tier: 2, element: '⚡', mana: 14, dmgMult: 2.0, effect: 'chain',       evolves: 'thunder_god',    desc: '번개가 연쇄 타격. 피해 1.2배 추가.', cost: { souls: 12, gold: 1500000 } },
    { id: 'thunder_god',  name: '뇌신',          tier: 3, element: '⚡', mana: 28,  dmgMult: 3.8, effect: 'electrify',   evolves: 'judgment_bolt',  desc: '뇌신의 힘으로 강타. 3턴간 방어력 무시.', cost: { souls: 45, gold: 9000000 } },
    { id: 'judgment_bolt',name: '심판의 벼락',   tier: 4, element: '⚡', mana: 55,  dmgMult: 5.5, effect: 'stun_heavy',  evolves: null,             desc: '하늘의 심판. 50% 확률 2턴 기절.', cost: { souls: 90, gold: 35000000 } },
    // ── 어둠 계열 ──────────────────────────────────────
    { id: 'shadow_bolt',  name: '쉐도우 볼트',   tier: 1, element: '🌑', mana: 7,   dmgMult: 1.6, effect: 'curse',       evolves: 'dark_nova',      desc: '어둠의 에너지. 저주로 보스 방어 -15%.', cost: { souls: 4,  gold: 300000 } },
    { id: 'dark_nova',    name: '다크 노바',      tier: 2, element: '🌑', mana: 18,  dmgMult: 2.5, effect: 'curse_heavy', evolves: 'void_rift',      desc: '어둠이 폭발. 보스 방어 -30%.', cost: { souls: 15, gold: 2000000 } },
    { id: 'void_rift',    name: '공허의 균열',   tier: 3, element: '🌑', mana: 35,  dmgMult: 4.2, effect: 'void',        evolves: 'annihilation',   desc: '공허를 열어 적을 빨아들인다. 방어 완전 무시.', cost: { souls: 60, gold: 15000000 } },
    { id: 'annihilation', name: '소멸',           tier: 4, element: '🌑', mana: 70,  dmgMult: 7.0, effect: 'doom',        evolves: null,             desc: '존재 자체를 지운다. 현재 보스 HP의 15% 추가.', cost: { souls: 120, gold: 60000000 } },
    // ── 신성 계열 ──────────────────────────────────────
    { id: 'holy_light',   name: '홀리 라이트',   tier: 1, element: '✨', mana: 6,   dmgMult: 1.2, effect: 'heal_self',   evolves: 'divine_wrath',   desc: '신성한 빛으로 자신을 치유. +15% HP.', cost: { souls: 4,  gold: 300000 } },
    { id: 'divine_wrath', name: '신성한 분노',   tier: 2, element: '✨', mana: 16,  dmgMult: 2.3, effect: 'smite',       evolves: 'archangel',      desc: '신의 분노로 타격. 크리티컬 50% 보장.', cost: { souls: 18, gold: 3000000 } },
    { id: 'archangel',    name: '대천사',         tier: 3, element: '✨', mana: 38,  dmgMult: 4.0, effect: 'barrier',     evolves: 'divine_judgment',desc: '대천사 강림. 다음 2턴 피해 50% 방어.', cost: { souls: 70, gold: 18000000 } },
    { id: 'divine_judgment',name: '신의 심판',  tier: 4, element: '✨', mana: 65,  dmgMult: 6.5, effect: 'holy_full',   evolves: null,             desc: '신의 심판. 광폭화한 보스에게 피해 2배.', cost: { souls: 110, gold: 50000000 } },
];

const MAGIC_EVOLUTION_CHAIN = {}; // id → evolves
for (const m of MAGIC_BOOKS) {
    if (m.evolves) MAGIC_EVOLUTION_CHAIN[m.id] = m.evolves;
}

function getMagicBook(id) { return MAGIC_BOOKS.find(m => m.id === id) || null; }

// 마력(MP) 장비 옵션 합산
function calcManaFromEquip(equipment) {
    let mana = 0, regen = 0;
    for (const slot of ['weapon','armor','shield','ring1','ring2']) {
        const it = equipment && equipment[slot];
        if (!it || it.broken) continue;
        if (it.effect && it.effect.id === 'mana') mana += it.effect.value || 0;
        if (it.effect && it.effect.id === 'manaRegen') regen += it.effect.value || 0;
    }
    return { mana: Math.round(mana), regen: Math.round(regen) };
}

// 최대 마력 계산 (기본 20 + 스킬/장비 보너스)
function calcMaxMana(user) {
    const BASE_MANA = 20;
    const { mana } = calcManaFromEquip(user.equipment);
    const skillMana = (user.skills || []).reduce((s, sk) => {
        const b = MAGIC_BOOKS.find(m => m.id === sk); // 마법 id를 skills에 저장
        return s; // 마법은 spells 배열에 별도 저장
    }, 0);
    return BASE_MANA + mana;
}

// 마법 효과 적용 (레이드 턴 내)
function applyMagicEffect(spell, session, log) {
    if (!spell.effect) return;
    switch (spell.effect) {
        case 'burn':       session.bossDebuffs.push({ type: 'burn', turns: 2, value: 5 });  log.push('🔥 화상 상태 (2턴)'); break;
        case 'burn_heavy': session.bossDebuffs.push({ type: 'burn', turns: 3, value: 12 }); log.push('🔥🔥 강화 화상 (3턴)'); break;
        case 'slow':       session.bossDebuffs.push({ type: 'slow', turns: 2, value: 10 }); log.push('❄️ 감속 (2턴, 보스 공격력 -10%)'); break;
        case 'freeze':     session.bossDebuffs.push({ type: 'freeze', turns: 1, value: 0 }); log.push('❄️ 빙결 (1턴 공격 봉인)'); break;
        case 'freeze_heavy': session.bossDebuffs.push({ type: 'freeze', turns: 2, value: 0 }); log.push('❄️❄️ 강화 빙결 (2턴 공격 봉인)'); break;
        case 'full_freeze':  session.bossDebuffs.push({ type: 'freeze', turns: 2, value: 0 }); log.push('❄️ 절대 빙결 (2턴 완전 봉인)'); break;
        case 'chain':      log.push('⚡ 연쇄 번개 추가 타격'); break;
        case 'electrify':  session.bossDebuffs.push({ type: 'electrify', turns: 3, value: 1 }); log.push('⚡ 감전 (3턴 방어 무시)'); break;
        case 'stun':       if (Math.random() < 0.3) { session.bossDebuffs.push({ type: 'freeze', turns: 1, value: 0 }); log.push('💫 기절!'); } break;
        case 'stun_heavy': if (Math.random() < 0.5) { session.bossDebuffs.push({ type: 'freeze', turns: 2, value: 0 }); log.push('💫💫 강화 기절 (2턴)!'); } break;
        case 'curse':      session.bossDebuffs.push({ type: 'defDown', turns: 2, value: 15 }); log.push('🌑 저주 (방어력 -15%, 2턴)'); break;
        case 'curse_heavy':session.bossDebuffs.push({ type: 'defDown', turns: 3, value: 30 }); log.push('🌑🌑 강화 저주 (방어력 -30%, 3턴)'); break;
        case 'void':       session.bossDebuffs.push({ type: 'pierce100', turns: 2, value: 0 }); log.push('🌑 공허 (2턴 방어 완전 무시)'); break;
        case 'doom':       break; // dmgMult에 추가 처리
        case 'heal_self':  { const h = Math.floor(session.maxHp * 0.15); session.hp = Math.min(session.maxHp, session.hp + h); log.push(`✨ 치유: +${h} HP`); break; }
        case 'smite':      session.nextCritGuaranteed = true; log.push('✨ 다음 공격 크리티컬 보장'); break;
        case 'barrier':    session.playerBarrier = 2; log.push('✨ 방어 장벽 (2턴 피해 50% 감소)'); break;
        case 'holy_full':  if (session.enraged) { log.push('✨ 광폭화 대상 → 피해 2배 적용!'); } break;
    }
}

// debuff 틱 처리
function tickBossDebuffs(session, log) {
    if (!session.bossDebuffs) session.bossDebuffs = [];
    const keep = [];
    for (const d of session.bossDebuffs) {
        d.turns--;
        if (d.type === 'burn') {
            const tick = Math.floor(session.boss.maxHp * d.value / 100);
            session.bossHp = Math.max(0, session.bossHp - tick);
            log.push(`🔥 화상 피해: ${tick}`);
        }
        if (d.turns > 0) keep.push(d);
    }
    session.bossDebuffs = keep;
}

// 마법 합성 체크 — spells 배열에서 id가 10개 이상이면 evolve
function checkMagicEvolution(user) {
    const msgs = [];
    for (const [baseId, evolveId] of Object.entries(MAGIC_EVOLUTION_CHAIN)) {
        const count = (user.spells || []).filter(id => id === baseId).length;
        if (count >= 10) {
            const removeCount = Math.floor(count / 10) * 10;
            let removed = 0;
            user.spells = (user.spells || []).filter(id => {
                if (id === baseId && removed < removeCount) { removed++; return false; }
                return true;
            });
            const gained = Math.floor(count / 10);
            for (let i = 0; i < gained; i++) user.spells.push(evolveId);
            const base = getMagicBook(baseId);
            const next = getMagicBook(evolveId);
            if (base && next) msgs.push(`🌟 합성! ${base.name} × ${removeCount} → ${next.name} × ${gained}`);
        }
    }
    return msgs;
}

const SKILL_BOOKS = {
    // 공격계열
    'A급 검술':         { grade: '고급', type: 'passive', stat: 'atk', value: 10, desc: '기본 공격력 +10 (영구)', cost: { souls: 5,  gold: 500000 } },
    'S급 검술':         { grade: '영웅', type: 'passive', stat: 'atk', value: 25, desc: '기본 공격력 +25 (영구)', cost: { souls: 15, gold: 3000000 } },
    'SS급 검술':        { grade: '전설', type: 'passive', stat: 'atk', value: 60, desc: '기본 공격력 +60 (영구)', cost: { souls: 40, gold: 20000000 } },
    // 방어계열
    'A급 방어술':       { grade: '고급', type: 'passive', stat: 'def', value: 8,  desc: '기본 방어력 +8 (영구)',  cost: { souls: 5,  gold: 500000 } },
    'S급 방어술':       { grade: '영웅', type: 'passive', stat: 'def', value: 20, desc: '기본 방어력 +20 (영구)', cost: { souls: 15, gold: 3000000 } },
    'SS급 방어술':      { grade: '전설', type: 'passive', stat: 'def', value: 50, desc: '기본 방어력 +50 (영구)', cost: { souls: 40, gold: 20000000 } },
    // 체력계열
    'A급 강인함':       { grade: '고급', type: 'passive', stat: 'hp',  value: 100,desc: '기본 HP +100 (영구)',   cost: { souls: 5,  gold: 500000 } },
    'S급 강인함':       { grade: '영웅', type: 'passive', stat: 'hp',  value: 250,desc: '기본 HP +250 (영구)',   cost: { souls: 15, gold: 3000000 } },
    'SS급 강인함':      { grade: '전설', type: 'passive', stat: 'hp',  value: 600,desc: '기본 HP +600 (영구)',   cost: { souls: 40, gold: 20000000 } },
    // 전투 특수
    '연속타':           { grade: '영웅', type: 'combat', effect: 'extraHit', value: 15, desc: '전투 중 15% 확률로 추가 공격', cost: { souls: 20, gold: 5000000 } },
    '강철 의지':        { grade: '전설', type: 'combat', effect: 'lastStand', value: 30, desc: 'HP 20% 이하 시 공격력 +30%', cost: { souls: 60, gold: 30000000 } },
    '용의 피':          { grade: '신화', type: 'combat', effect: 'dragonBlood', value: 50, desc: '매 턴 최대HP 2% 회복 + 공격력 +50', cost: { souls: 150, gold: 200000000 } },
    '진명해방 각성':    { grade: '태초', type: 'combat', effect: 'ultimateAwaken', value: 100, desc: '진명해방 스킬 효과 2배', cost: { souls: 500, gold: 2000000000 } },
};

const SKILL_GRADE_ORDER = ['고급','영웅','전설','신화','태초'];

// 스킬 패시브 스탯 합산
function calcSkillStat(skills) {
    let atk = 0, def = 0, hp = 0;
    for (const skillName of (skills || [])) {
        const sk = SKILL_BOOKS[skillName];
        if (!sk || sk.type !== 'passive') continue;
        if (sk.stat === 'atk') atk += sk.value;
        else if (sk.stat === 'def') def += sk.value;
        else if (sk.stat === 'hp') hp += sk.value;
    }
    return { atk, def, hp };
}

// ─────────────────────────────────────────────
// Phase 6: 시즌 시스템
// ─────────────────────────────────────────────
const SEASON_CONFIG = {
    name: '시즌 1: 태초의 균열',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    rewards: [
        { rank: 1, gold: 500000000, stones: 500, souls: 100, title: '🏆[시즌 챔피언]' },
        { rank: 2, gold: 200000000, stones: 300, souls: 60,  title: '🥈[준우승]' },
        { rank: 3, gold: 100000000, stones: 200, souls: 40,  title: '🥉[3위]' },
        { rank: 10, gold: 30000000, stones: 80,  souls: 15,  title: '⭐[시즌 TOP10]' },
    ]
};

// 가챠 아이템 풀 (등급별)
const GACHA_ITEM_POOL = {
    꽝: [
        { name: '빈봉투', type: 'nothing', value: 0, desc: '아무것도 없습니다...' }
    ],
    일반: [
        { name: '소액현금권', type: 'cash', value: 10000, desc: '즉시 1만P 지급' },
        { name: '섯다 부적(하)', type: 'sutda_hint', value: 1, desc: '섯다 족보 힌트 (낮은 정확도)' },
        { name: '숫자 감지기(하)', type: 'numguess_hint', value: 1, desc: '숫자맞추기 오답 1개 제거' },
        { name: '바카라 코인(하)', type: 'baccarat_boost', value: 2, desc: '바카라 배당 +2%' }
    ],
    희귀: [
        { name: '중액현금권', type: 'cash', value: 100000, desc: '즉시 10만P 지급' },
        { name: '섯다 부적(중)', type: 'sutda_hint', value: 3, desc: '섯다 족보 힌트 (중간 정확도)' },
        { name: '패교체권(1회)', type: 'card_change', value: 1, desc: '섯다 패 교체 1회 사용 가능' },
        { name: '블랙잭 보험', type: 'bj_insurance', value: 1, desc: '블랙잭 버스트 시 배팅액 50% 환급' },
        { name: '숫자 감지기(중)', type: 'numguess_hint', value: 2, desc: '숫자맞추기 오답 2개 제거' }
    ],
    영웅: [
        { name: '고액현금권', type: 'cash', value: 1000000, desc: '즉시 100만P 지급' },
        { name: '패교체권(2회)', type: 'card_change', value: 2, desc: '섯다 패 교체 2회 사용 가능' },
        { name: '딜러봉인권', type: 'dealer_seal', value: 1, desc: '섯다 딜러 다이 확률 0%로 고정(1판)' },
        { name: '블랙잭 투시경', type: 'bj_peek', value: 1, desc: '블랙잭 딜러 숨긴 패 공개' },
        { name: '바카라 코인(상)', type: 'baccarat_boost', value: 8, desc: '바카라 배당 +8%' },
        { name: '주사위 조작기(하)', type: 'dice_boost', value: 5, desc: '1:1주사위 유리한 눈 확률 +5%' }
    ],
    전설: [
        { name: '전설현금권', type: 'cash', value: 10000000, desc: '즉시 1000만P 지급' },
        { name: '광땡설계도(소)', type: 'gwangddaeng', value: 3, desc: '섯다 시작 시 광땡 확률 +3%' },
        { name: '블랙잭 신의손', type: 'bj_divine', value: 1, desc: '블랙잭 첫패 블랙잭 확률 +10%' },
        { name: '수수료면제권', type: 'fee_waive', value: 1, desc: '다음 게임 수수료 면제(1회)' },
        { name: '주사위 조작기(상)', type: 'dice_boost', value: 15, desc: '1:1주사위 유리한 눈 확률 +15%' }
    ],
    신화: [
        { name: '신화현금권', type: 'cash', value: 100000000, desc: '즉시 1억P 지급' },
        { name: '광땡설계도(대)', type: 'gwangddaeng', value: 10, desc: '섯다 시작 시 광땡 확률 +10%' },
        { name: '타짜의 신 증명서', type: 'sutda_god', value: 1, desc: '섯다 승리 시 수수료 면제 + 패교체 3회' },
        { name: '신화반지', type: 'gacha_boost', value: 10, desc: '랜덤상자 개봉 시 등급 확률 10% 상향' },
        { name: '전지전능권', type: 'omniscient', value: 1, desc: '모든 게임 수수료 면제 + 모든 버프 적용(1판)' }
    ]
};

// 섯다 덱
const DECK = [
    { m: 1, name: '1광' }, { m: 1, name: '1피' }, { m: 2, name: '2열' }, { m: 2, name: '2피' },
    { m: 3, name: '3광' }, { m: 3, name: '3피' }, { m: 4, name: '4열' }, { m: 4, name: '4피' },
    { m: 5, name: '5열' }, { m: 5, name: '5피' }, { m: 6, name: '6열' }, { m: 6, name: '6피' },
    { m: 7, name: '7열' }, { m: 7, name: '7피' }, { m: 8, name: '8광' }, { m: 8, name: '8열' },
    { m: 9, name: '9열' }, { m: 9, name: '9피' }, { m: 10, name: '10열' }, { m: 10, name: '10피' }
];

// 퀴즈
const QUIZZES = [
    { q: '세상에서 가장 가난한 왕은?', a: '최저임금' },
    { q: '차가 울면 무엇일까요?', a: '카잉' },
    { q: '오리가 얼면 무엇이 될까요?', a: '언덕' },
    { q: '영화 타짜에서 아귀가 밑장빼기 하려다 걸린 화투 패는?', a: '단풍' },
    { q: '조선시대 백성들을 위해 훈민정음을 창제하신 임금은?', a: '세종대왕' }
];

// 코인 뉴스 (진짜/가짜 포함)
const NEWS_POOL = {
    '성빈코인': {
        up_real:   ['📰 [속보] 성빈코인 재단, 글로벌 거래소 상장 확정!', '📰 [호재] 기관 투자자 대규모 매집 포착!'],
        up_fake:   ['📰 [찌라시] 성빈코인 화성 이주지 화폐 채택 루머 확산...'],
        down_real: ['📰 [경보] 개발자 지갑 대규모 이동 포착! 투매 우려', '📰 [속보] 정부 규제 조사 착수'],
        down_fake: ['📰 [루머] 성빈코인 해킹 피해 제보...사실 여부 불명확']
    },
    '호근코인': {
        up_real:   ['📰 [호재] 호근코인 ETF 승인 완료', '📰 [뉴스] 고래들 물량 락업 계약 체결'],
        up_fake:   ['📰 [찌라시] 워렌버핏이 호근코인 매집?...확인 불가'],
        down_real: ['📰 [경보] 블록체인 오류 발생 마비', '📰 [악재] 대주주 세금 체납 지분 청산'],
        down_fake: ['📰 [루머] 호근코인 내부 분열설...공식 부인']
    },
    '정재코인': {
        up_real:   ['📰 [속보] 정재코인 결제 시스템 도입 확정!', '📰 [호재] 글로벌 파트너십 체결'],
        up_fake:   ['📰 [찌라시] 정재코인 대기업 인수설 돌아...'],
        down_real: ['📰 [🚨상폐] 상장폐지 실질심사 대상 지정!', '📰 [악재] 커뮤니티 해킹 신뢰도 추락'],
        down_fake: ['📰 [루머] 정재코인 개발자 먹튀설...진위 불명']
    },
    '몰탈코인': {
        up_real:   ['📰 [속보] 몰탈코인 정체불명 고래 대규모 매집!', '📰 [호재] 글로벌 상장 발표'],
        up_fake:   ['📰 [찌라시] 몰탈코인 유명인 보유 루머...'],
        down_real: ['📰 [경보] 공식 텔레그램 폐쇄 먹튀 의혹', '📰 [속보] 핵심 개발자 잠적'],
        down_fake: ['📰 [루머] 몰탈코인 경쟁사 공격설...확인중']
    },
    '펭즈코인': {
        up_real:   ['📰 [화제] 인플루언서 언급에 거래량 폭증!', '📰 [호재] 밈 챌린지 전세계 확산'],
        up_fake:   ['📰 [찌라시] 펭즈코인 유명 연예인 투자설...'],
        down_real: ['📰 [뉴스] 밈 유행 시들 거래량 급감', '📰 [경보] 커뮤니티 분열 신뢰도 하락'],
        down_fake: ['📰 [루머] 펭즈코인 가짜 거래량 의혹...조사중']
    },
    '첨지코인': {
        up_real:   ['📰 [찌라시] 큰손 매수세 집중!', '📰 [속보] 기관 자금 유입 포착'],
        up_fake:   ['📰 [루머] 첨지코인 정부 채택설...사실무근?'],
        down_real: ['📰 [경보] 큰손 물량 이탈 시장 동요', '📰 [악재] 규제 검토 매도 압력'],
        down_fake: ['📰 [찌라시] 첨지코인 내부자 대량 매도설...미확인']
    }
};

// 업적 정의 (게임별 레벨업형)
const ACHIEVEMENTS = {
    sutda: [
        { level: 1, wins: 10,   title: '초보 타짜',     display: (n) => `[초보 타짜] ${n}` },
        { level: 2, wins: 50,   title: '타짜',           display: (n) => `⚡[타짜] ${n}` },
        { level: 3, wins: 200,  title: '베테랑 타짜',   display: (n) => `🔥[베테랑 타짜] ${n}` },
        { level: 4, wins: 500,  title: '전설의 타짜',   display: (n) => `💫✨[전설의 타짜]✨💫 ${n}` },
        { level: 5, wins: 1000, title: '타짜의 신',     display: (n) => `👑🎴⚡[타짜의 신]⚡🎴👑 ${n}` }
    ],
    blackjack: [
        { level: 1, wins: 10,   title: '블랙잭 입문자',  display: (n) => `[블랙잭 입문자] ${n}` },
        { level: 2, wins: 50,   title: '카드 카운터',    display: (n) => `🃏[카드 카운터] ${n}` },
        { level: 3, wins: 200,  title: '블랙잭 고수',    display: (n) => `🎯🃏[블랙잭 고수] ${n}` },
        { level: 4, wins: 500,  title: '카지노의 왕',    display: (n) => `👑🃏✨[카지노의 왕]✨🃏👑 ${n}` },
        { level: 5, wins: 1000, title: '블랙잭의 신',    display: (n) => `🌟👑🎴[블랙잭의 신]🎴👑🌟 ${n}` }
    ],
    baccarat: [
        { level: 1, wins: 10,   title: '바카라 입문자',  display: (n) => `[바카라 입문자] ${n}` },
        { level: 2, wins: 50,   title: '배팅 전문가',    display: (n) => `💰[배팅 전문가] ${n}` },
        { level: 3, wins: 200,  title: '바카라 고수',    display: (n) => `💎💰[바카라 고수] ${n}` },
        { level: 4, wins: 500,  title: '마카오의 전설',  display: (n) => `🎰💎✨[마카오의 전설]✨💎🎰 ${n}` },
        { level: 5, wins: 1000, title: '바카라의 신',    display: (n) => `👑🎰🌟[바카라의 신]🌟🎰👑 ${n}` }
    ],
    numberGuess: [
        { level: 1, wins: 10,   title: '수비학 입문자',  display: (n) => `[수비학 입문자] ${n}` },
        { level: 2, wins: 50,   title: '숫자 감각자',    display: (n) => `🔢[숫자 감각자] ${n}` },
        { level: 3, wins: 200,  title: '수비학 고수',    display: (n) => `🎯🔢[수비학 고수] ${n}` },
        { level: 4, wins: 500,  title: '예언자',         display: (n) => `🔮🎯✨[예언자]✨🎯🔮 ${n}` },
        { level: 5, wins: 1000, title: '수비학의 신',    display: (n) => `👑🔮🌟[수비학의 신]🌟🔮👑 ${n}` }
    ],
    duel: [
        { level: 1, wins: 10,   title: '주사위 초보',    display: (n) => `[주사위 초보] ${n}` },
        { level: 2, wins: 50,   title: '주사위 도박사',  display: (n) => `🎲[주사위 도박사] ${n}` },
        { level: 3, wins: 200,  title: '주사위 고수',    display: (n) => `⚡🎲[주사위 고수] ${n}` },
        { level: 4, wins: 500,  title: '운명을 건 자',   display: (n) => `🌀🎲✨[운명을 건 자]✨🎲🌀 ${n}` },
        { level: 5, wins: 1000, title: '주사위의 신',    display: (n) => `👑🎲🌟[주사위의 신]🌟🎲👑 ${n}` }
    ]
};

// ─────────────────────────────────────────────
// 특수 타이틀 (RPG 진행/컬렉션/부/전설 계열)
// !내정보에서 최고 등급 5개까지 함께 표시
// 각 함수는 user 객체 받아 조건 만족 시 타이틀 문자열 반환, 아니면 null
// ─────────────────────────────────────────────
const SPECIAL_TITLES = [
    // 최종보스 (최고 우선순위)
    { id: 'finalBoss', priority: 100, check: (u) => (u.bossKills && u.bossKills['혼돈의 지배자'] > 0) ? '🌟👑💫[혼돈을 정복한 자]💫👑🌟' : null },
    
    // RPG 진행 계열
    { id: 'boss10',   priority: 90, check: (u) => (u.bossKills && Object.keys(u.bossKills).length >= 10) ? '👑⚔️[대륙의 영웅]' : null },
    { id: 'boss5',    priority: 80, check: (u) => (u.bossKills && Object.keys(u.bossKills).length >= 5) ? '🛡️⚔️[정예 모험가]' : null },
    { id: 'boss1',    priority: 60, check: (u) => (u.bossKills && Object.keys(u.bossKills).length >= 1) ? '⚔️[모험가]' : null },
    
    // 사냥 계열
    { id: 'hunt1000', priority: 75, check: (u) => (u.huntWins || 0) >= 1000 ? '🎯🏹[사냥의 달인]' : null },
    { id: 'hunt100',  priority: 55, check: (u) => (u.huntWins || 0) >= 100 ? '🏹[숙련된 사냥꾼]' : null },
    { id: 'hunt1',    priority: 35, check: (u) => (u.huntWins || 0) >= 1 ? '🌱[초보 사냥꾼]' : null },
    
    // 컬렉션 계열
    { id: 'primordial', priority: 85, check: (u) => {
        for (const [n, p] of Object.entries(u.partyMembers || {})) {
            if (PARTY_MEMBERS[n]?.grade === '태초' && ((p.count||0) + (p.level||0) > 0)) return '✨[태초의 목격자]';
        }
        return null;
    }},
    { id: 'collector', priority: 65, check: (u) => {
        const grades = new Set();
        for (const [n, p] of Object.entries(u.partyMembers || {})) {
            if ((p.count||0) + (p.level||0) > 0 && PARTY_MEMBERS[n]) grades.add(PARTY_MEMBERS[n].grade);
        }
        return grades.size >= 7 ? '🎭[모든 등급 수집가]' : null;
    }},
    
    // 부의 상징
    { id: 'ultraRich', priority: 95, check: (u) => {
        const nw = calcNetWorth(u);
        return nw.total >= 10000000000000000 ? '💰💰💰[경제 지배자]' : null; // 1경
    }},
    { id: 'megaRich', priority: 70, check: (u) => {
        const nw = calcNetWorth(u);
        return nw.total >= 100000000000000 ? '💰💰[초대형 재벌]' : null; // 100조
    }},
    { id: 'rich', priority: 50, check: (u) => {
        const nw = calcNetWorth(u);
        return nw.total >= 1000000000000 ? '💰[재벌]' : null; // 1조
    }},
];

// 유저가 획득한 특수 타이틀 목록 (우선순위 정렬)
function getEarnedTitles(user) {
    const earned = [];
    for (const t of SPECIAL_TITLES) {
        const title = t.check(user);
        if (title) earned.push({ id: t.id, priority: t.priority, title });
    }
    earned.sort((a, b) => b.priority - a.priority);
    return earned;
}

// ═══════════════════════════════════════════════════════
// 3. 런타임 상태
// ═══════════════════════════════════════════════════════
let LUXURY_MARKET = {}; // 레거시 (빈 객체로 유지, 삭제 후 하위 참조 안전)
let COIN_MARKET = {};
const gameSessions = {};      // 섯다
const blackjackSessions = {}; // 블랙잭
const baccaratSessions = {};  // 바카라
const numberGuessSessions = {};// 숫자맞추기
const duelSessions = {};      // 1:1 주사위
let currentQuiz = null;
let quizTimer = null;
let activeNewsRooms = [];     // 뉴스 활성화된 방 목록

// ═══════════════════════════════════════════════════════
// 4. 저장/로드
// ═══════════════════════════════════════════════════════
function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        console.error('users.json 로드 실패:', e.message);
        return {};
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('users.json 저장 실패:', e.message);
    }
}

const MIN_BALANCE = 2000;
// 잔액이 MIN_BALANCE 이하면 자동 충전. 충전 시 메시지 반환(없으면 null).
function checkMinBalance(user) {
    if (user.points < MIN_BALANCE) {
        const added = MIN_BALANCE - user.points;
        user.points = MIN_BALANCE;
        return `💸 잔액 부족 — 최소 보장금 ${added.toLocaleString()}원이 지급되었습니다. (잔액: ${formatKRW(MIN_BALANCE)})`;
    }
    return null;
}


function loadMarket() {
    try {
        if (fs.existsSync(MARKET_FILE)) {
            const data = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
            LUXURY_MARKET = {}; // 사치품 제거됨
            COIN_MARKET = data.coin || {};
            for (const [k, v] of Object.entries(DEFAULT_COIN)) {
                if (!COIN_MARKET[k]) COIN_MARKET[k] = JSON.parse(JSON.stringify(v));
            }
            saveMarket();
            return;
        }
    } catch (e) {
        console.error('market.json 로드 실패:', e.message);
    }
    LUXURY_MARKET = {};
    COIN_MARKET = JSON.parse(JSON.stringify(DEFAULT_COIN));
    saveMarket();
}

function saveMarket() {
    try {
        fs.writeFileSync(MARKET_FILE, JSON.stringify({ luxury: LUXURY_MARKET, coin: COIN_MARKET }, null, 2), 'utf8');
    } catch (e) {
        console.error('market.json 저장 실패:', e.message);
    }
}

// ═══════════════════════════════════════════════════════
// 5. 유저 정규화
// ═══════════════════════════════════════════════════════
function createDefaultUser() {
    return {
        points: 2000,        // 골드 (기존 points 유지)
        stones: 0,           // 강화석 (사냥터에서만 획득)
        souls: 0,            // 소울 (8단계 이상 레이드 확률 획득)
        lastCheckIn: '',
        items: [],
        coins: {},
        gachaItems: [],
        boxes: {},
        loan: { amount: 0, takenAt: 0 },
        deposit: { amount: 0, depositedAt: 0 },
        seized: false,
        // === RPG ===
        partyMembers: {},    // { '김판돌': { count: N, level: N } } — 10명 모으면 +1강화
        activeParty: [],     // 편성된 파티원 이름 배열 (최대 3)
        equipment: { weapon: null, armor: null, shield: null, ring1: null, ring2: null },
        equipmentInventory: [], // 보유 장비 (미장착) 목록
        skills: [],          // 학습한 스킬 목록
        spells: [],          // 보유 마법 ID 목록 (중복 허용, 10개 합성)
        spellSlots: [null, null], // 퀵슬롯 [slot1_id, slot2_id]
        mana: 20,            // 현재 마력 (레이드 시작 시 maxMana로 충전)
        huntCount: 0,        // 사냥 횟수
        huntWins: 0,         // 사냥 성공
        activeHunt: null,    // 진행 중인 사냥 { groundName, startedAt, power } — DB 저장용
        bossKills: {},       // { '킹슬라임': N, ... } 보스별 처치 횟수
        lastRaidAt: 0,       // 마지막 레이드 시작 시각 (쿨타임)
        firstBossClears: {}, // 최초 클리어 기록
        lastHuntAt: 0,       // 마지막 사냥 시각 (쿨타임)
        lastRaidAt: 0,       // 마지막 레이드 시각
        // === 통계 ===
        stats: {
            sutda:       { wins: 0, losses: 0, draws: 0 },
            blackjack:   { wins: 0, losses: 0 },
            baccarat:    { wins: 0, losses: 0 },
            numberGuess: { wins: 0, losses: 0 },
            duel:        { wins: 0, losses: 0 }
        }
    };
}

function normalizeHolding(raw) {
    if (typeof raw === 'number') return raw > 0 ? { count: raw, avgPrice: 0 } : { count: 0, avgPrice: 0 };
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return {
            count: (typeof raw.count === 'number' && !isNaN(raw.count)) ? raw.count : 0,
            avgPrice: (typeof raw.avgPrice === 'number' && !isNaN(raw.avgPrice)) ? raw.avgPrice : 0
        };
    }
    return { count: 0, avgPrice: 0 };
}

function ensureUser(db, name) {
    let u = Object.prototype.hasOwnProperty.call(db, name) ? db[name] : null;
    if (!u || typeof u !== 'object' || Array.isArray(u)) u = createDefaultUser();

    if (typeof u.points !== 'number' || isNaN(u.points)) u.points = 2000;
    if (typeof u.lastCheckIn !== 'string') u.lastCheckIn = '';
    if (!Array.isArray(u.items)) u.items = [];
    if (u.luxuries) delete u.luxuries; // 사치품 제거됨
    if (!u.coins || typeof u.coins !== 'object') u.coins = {};
    // 기존 employees 필드는 삭제 (RPG 개편으로 제거됨)
    if (u.employees) delete u.employees;
    if (!Array.isArray(u.gachaItems)) u.gachaItems = [];
    if (!u.boxes || typeof u.boxes !== 'object') u.boxes = {};
    if (!u.loan || typeof u.loan !== 'object') u.loan = { amount: 0, takenAt: 0 };
    if (!u.deposit || typeof u.deposit !== 'object') u.deposit = { amount: 0, depositedAt: 0 };
    else {
        if (typeof u.deposit.amount !== 'number' || isNaN(u.deposit.amount)) u.deposit.amount = 0;
        if (typeof u.deposit.depositedAt !== 'number' || isNaN(u.deposit.depositedAt)) u.deposit.depositedAt = 0;
    }
    if (typeof u.seized !== 'boolean') u.seized = false;
    if (!u.stats || typeof u.stats !== 'object') u.stats = createDefaultUser().stats;
    // === RPG 필드 정규화 ===
    if (typeof u.stones !== 'number' || isNaN(u.stones)) u.stones = 0;
    if (typeof u.souls !== 'number' || isNaN(u.souls)) u.souls = 0;
    if (!u.partyMembers || typeof u.partyMembers !== 'object') u.partyMembers = {};
    if (!Array.isArray(u.activeParty)) u.activeParty = [];
    if (!u.equipment || typeof u.equipment !== 'object') u.equipment = { weapon: null, armor: null, shield: null, ring1: null, ring2: null };
    else {
        for (const slot of ['weapon','armor','shield','ring1','ring2']) {
            if (!(slot in u.equipment)) u.equipment[slot] = null;
            const it = u.equipment[slot];
            if (it && typeof it === 'object') {
                if (typeof it.enhanceLevel !== 'number' || isNaN(it.enhanceLevel)) it.enhanceLevel = 0;
                if (typeof it.atk !== 'number') it.atk = 0;
                if (typeof it.def !== 'number') it.def = 0;
                if (typeof it.hp !== 'number') it.hp = 0;
                if (typeof it.broken !== 'boolean') it.broken = false;
                if (it.effect === undefined) it.effect = null;
                if (!it.id) it.id = nextEquipId();
            }
        }
    }
    if (!Array.isArray(u.equipmentInventory)) u.equipmentInventory = [];
    else {
        u.equipmentInventory = u.equipmentInventory.filter(it => it && typeof it === 'object');
        for (const it of u.equipmentInventory) {
            if (typeof it.enhanceLevel !== 'number' || isNaN(it.enhanceLevel)) it.enhanceLevel = 0;
            if (typeof it.atk !== 'number') it.atk = 0;
            if (typeof it.def !== 'number') it.def = 0;
            if (typeof it.hp !== 'number') it.hp = 0;
            if (typeof it.broken !== 'boolean') it.broken = false;
            if (it.effect === undefined) it.effect = null;
            if (!it.id) it.id = nextEquipId();
        }
    }
    if (!Array.isArray(u.skills)) u.skills = [];
    if (typeof u.huntCount !== 'number' || isNaN(u.huntCount)) u.huntCount = 0;
    if (typeof u.huntWins !== 'number' || isNaN(u.huntWins)) u.huntWins = 0;
    if (!u.bossKills || typeof u.bossKills !== 'object') u.bossKills = {};
    if (!u.firstBossClears || typeof u.firstBossClears !== 'object') u.firstBossClears = {};
    if (typeof u.lastHuntAt !== 'number') u.lastHuntAt = 0;
    if (typeof u.lastRaidAt !== 'number') u.lastRaidAt = 0;
    if (u.activeHunt !== null && typeof u.activeHunt !== 'object') u.activeHunt = null;
    if (!Array.isArray(u.spells)) u.spells = [];
    if (!Array.isArray(u.spellSlots) || u.spellSlots.length < 2) u.spellSlots = [null, null];
    if (typeof u.mana !== 'number' || isNaN(u.mana)) u.mana = 20;
    // 파티원 데이터 정규화
    for (const k of Object.keys(u.partyMembers)) {
        const v = u.partyMembers[k];
        if (typeof v === 'number') u.partyMembers[k] = { count: v, level: 0 };
        else if (v && typeof v === 'object') {
            u.partyMembers[k] = {
                count: (typeof v.count === 'number' && !isNaN(v.count)) ? v.count : 0,
                level: (typeof v.level === 'number' && !isNaN(v.level)) ? v.level : 0
            };
        } else {
            u.partyMembers[k] = { count: 0, level: 0 };
        }
    }
    for (const game of ['sutda','blackjack','baccarat','numberGuess','duel']) {
        if (!u.stats[game]) u.stats[game] = { wins: 0, losses: 0, draws: 0 };
    }

    for (const c of COIN_NAMES) {
        u.coins[c] = normalizeHolding(u.coins[c] || 0);
    }

    db[name] = u;
    return u;
}

function userExists(db, name) {
    return Object.prototype.hasOwnProperty.call(db, name)
        && db[name] && typeof db[name] === 'object' && !Array.isArray(db[name]);
}

function updateAvgBuy(holding, qty, price) {
    const oldCount = holding.count || 0;
    const oldAvg = holding.avgPrice || 0;
    const newCount = oldCount + qty;
    holding.count = newCount;
    holding.avgPrice = newCount > 0 ? Math.round((oldAvg * oldCount + price * qty) / newCount) : 0;
}

// 대출 이자 계산 (시간당 3%)
function calcLoanDebt(loan) {
    if (!loan || loan.amount <= 0 || loan.takenAt <= 0) return 0;
    const hoursElapsed = (Date.now() - loan.takenAt) / 3600000;
    const rate = CONFIG.loan.hourlyInterestRate / 100;
    return Math.floor(loan.amount * Math.pow(1 + rate, hoursElapsed));
}

// 예금 이자 계산 (예치 후 graceMinutes 지나야 이자 발생, 단리 · 아주 적은 이율)
function calcDepositInterest(deposit) {
    if (!deposit || deposit.amount <= 0 || deposit.depositedAt <= 0) return 0;
    const elapsedMin = (Date.now() - deposit.depositedAt) / 60000;
    const grace = CONFIG.deposit.graceMinutes;
    if (elapsedMin < grace) return 0;
    const interestHours = (elapsedMin - grace) / 60;
    const rate = CONFIG.deposit.hourlyInterestRate / 100;
    return Math.floor(deposit.amount * rate * interestHours);
}

// ═══════════════════════════════════════════════════════
// 6. 헬퍼 함수
// ═══════════════════════════════════════════════════════
function formatKRW(n) {
    if (n == null || isNaN(n)) return '0원';
    const neg = n < 0;
    n = Math.abs(Math.floor(n));
    if (n === 0) return '0원';
    const 해 = Math.floor(n / 100_000_000_000_000_000_000);
    const 경 = Math.floor((n % 100_000_000_000_000_000_000) / 10_000_000_000_000_000);
    const 조 = Math.floor((n % 10_000_000_000_000_000) / 1_000_000_000_000);
    const 억 = Math.floor((n % 1_000_000_000_000) / 100_000_000);
    const 만 = Math.floor((n % 100_000_000) / 10_000);
    const 나머지 = n % 10_000;
    const parts = [];
    if (해 > 0) parts.push(`${해}해`);
    if (경 > 0) parts.push(`${경}경`);
    if (조 > 0) parts.push(`${조}조`);
    if (억 > 0) parts.push(`${억}억`);
    if (만 > 0) parts.push(`${만}만`);
    if (나머지 > 0) parts.push(`${나머지}원`);
    const result = parts.join(' ');
    return neg ? '-' + result : result;
}

function parseAmount(str) {
    if (str == null) return NaN;
    str = String(str).trim();
    const match = str.match(/^(\d+(?:\.\d+)?)(만|억|조)?$/);
    if (!match) return parseInt(str, 10);
    const num = parseFloat(match[1]);
    const unit = match[2];
    if (unit === '만') return Math.round(num * MAN);
    if (unit === '억') return Math.round(num * EOK);
    if (unit === '조') return Math.round(num * JO);
    return Math.round(num);
}

function resolveBetAmount(arg, maxPoints) {
    if (arg === '올인') return maxPoints;
    if (arg === '하프') return Math.floor(maxPoints / 2);
    if (arg === '삥') return 1000;
    if (arg === '따당') return maxPoints * 2; // 따당은 2배 — 잔고 검사는 호출부에서
    const n = parseAmount(arg);
    return isNaN(n) ? NaN : n;
}

function isFullKeyword(arg) { return arg === '풀'; }

function applyFee(amount, gameKey) {
    const feeRate = (CONFIG.fees[gameKey] || 0) / 100;
    const fee = Math.floor(amount * feeRate);
    return { net: amount - fee, fee };
}

// 보유 아이템 중 특정 타입 하나 소모 (가장 먼저 찾은 것)
function consumeItem(user, type) {
    const idx = user.gachaItems.findIndex(it => it.type === type);
    if (idx === -1) return false;
    user.gachaItems.splice(idx, 1);
    return true;
}

function hasItem(user, type) {
    return user.gachaItems.some(it => it.type === type);
}

function sumItemEffect(user, type) {
    return user.gachaItems.filter(it => it.type === type).reduce((s, it) => s + (it.value || 0), 0);
}

// ─────────────────────────────────────────────
// RPG 헬퍼 함수들
// ─────────────────────────────────────────────

// 파티원 강화 자동 처리 (10명 모이면 +1강화, count를 10 소모)
function promoteParty(user) {
    for (const name of Object.keys(user.partyMembers)) {
        const p = user.partyMembers[name];
        while (p.count >= 10) {
            p.count -= 10;
            p.level += 1;
        }
    }
}

// 파티원 전투 스탯 계산 (강화 레벨 반영)
// 레벨당 스킬 파워 +25%, 기본 공격력 기여도 별도
function calcPartyMemberPower(name, level) {
    const base = PARTY_MEMBERS[name];
    if (!base) return { skillPower: 0, atkContrib: 0 };
    const mult = 1 + (level * 0.25);
    return {
        skillPower: Math.floor(base.baseSkillPower * mult),
        atkContrib: Math.floor(base.baseSkillPower * mult * 0.5) // 편성만 해도 공격력 소량 기여
    };
}

// 장비 스탯 계산 (강화 레벨 반영)
function calcEquipmentStat(equipment) {
    let atk = 0, def = 0, hp = 0;
    if (!equipment) return { atk, def, hp };
    for (const slot of Object.keys(equipment)) {
        const eq = equipment[slot];
        if (!eq) continue;
        const eff = effectiveItemStat(eq);
        atk += eff.atk;
        def += eff.def;
        hp  += eff.hp;
    }
    return { atk, def, hp };
}

// 캐릭터 총 스탯 계산 (기본 + 장비 + 파티 기여)
function calcCharacterStat(user) {
    const BASE_ATK = 10;
    const BASE_DEF = 5;
    const BASE_HP  = 100;

    const eq = calcEquipmentStat(user.equipment);
    const sk = calcSkillStat(user.skills);
    let atk = BASE_ATK + eq.atk + sk.atk;
    let def = BASE_DEF + eq.def + sk.def;
    let hp  = BASE_HP  + eq.hp  + sk.hp;

    // 파티원 편성 기여
    for (const name of (user.activeParty || [])) {
        const p = user.partyMembers[name];
        if (!p) continue;
        const power = calcPartyMemberPower(name, p.level);
        atk += power.atkContrib;
    }

    return { atk, def, hp, maxHp: hp };
}

// 총자산 계산
function calcNetWorth(user) {
    let coinValue = 0;
    for (const [name, h] of Object.entries(user.coins || {})) {
        const count = h.count || 0;
        if (count > 0 && COIN_MARKET[name]) coinValue += COIN_MARKET[name].currentPrice * count;
    }
    const debt = calcLoanDebt(user.loan);
    const depositTotal = (user.deposit && user.deposit.amount > 0) ? (user.deposit.amount + calcDepositInterest(user.deposit)) : 0;
    return {
        cash: user.points,
        luxuryValue: 0, // 레거시 필드 유지 (참조 안전)
        coinValue,
        depositValue: depositTotal,
        empEarning: 0,
        debt,
        total: user.points + coinValue + depositTotal - debt
    };
}

// 업적 레벨 계산
function getAchievementLevel(user, game) {
    const wins = (user.stats[game] && user.stats[game].wins) || 0;
    const levels = ACHIEVEMENTS[game];
    if (!levels) return null;
    let current = null;
    for (const lvl of levels) {
        if (wins >= lvl.wins) current = lvl;
    }
    return current;
}

// 이름 표시 (업적 타이틀 적용)
function displayName(user, name) {
    // 가장 화려한(레벨 높은) 업적 우선
    const games = ['sutda','blackjack','baccarat','numberGuess','duel'];
    let best = null;
    for (const g of games) {
        const lvl = getAchievementLevel(user, g);
        if (lvl && (!best || lvl.level > best.level)) best = { lvl, g };
    }
    if (!best) return name;
    return best.lvl.display(name);
}

// 번호→이름 매핑
// getEmployeeList: 레거시 제거됨 (직원 시스템 폐지)
// resolveEmployeeName: 레거시 제거됨

// resolveOwnedEmployee: 레거시 제거됨

function formatChangeRate(avgPrice, currentPrice) {
    if (!avgPrice || avgPrice <= 0) return '';
    const rate = ((currentPrice - avgPrice) / avgPrice) * 100;
    return ` (${rate >= 0 ? '🔺+' : '🔻'}${Math.abs(rate).toFixed(1)}%)`;
}

// ═══════════════════════════════════════════════════════
// 7. 게임 로직
// ═══════════════════════════════════════════════════════

// ── 섯다 족보 ──────────────────────────────────────────
function evaluateHand(p1, p2) {
    const m1 = p1.m, m2 = p2.m, n1 = p1.name, n2 = p2.name;
    if ((n1==='3광'&&n2==='8광')||(n1==='8광'&&n2==='3광')) return { score:3000, name:'38광땡' };
    if ((n1==='1광'&&n2==='3광')||(n1==='3광'&&n2==='1광')) return { score:2900, name:'13광땡' };
    if ((n1==='1광'&&n2==='8광')||(n1==='8광'&&n2==='1광')) return { score:2800, name:'18광땡' };
    if (m1===m2) return { score:2000+m1*10, name:`${m1}땡` };
    const s = [m1,m2].sort((a,b)=>a-b);
    if (s[0]===1&&s[1]===2) return { score:1900, name:'알리' };
    if (s[0]===1&&s[1]===4) return { score:1800, name:'독사' };
    if (s[0]===1&&s[1]===9) return { score:1700, name:'구삥' };
    if (s[0]===1&&s[1]===10) return { score:1600, name:'장삥' };
    if (s[0]===4&&s[1]===10) return { score:1500, name:'장사' };
    if (s[0]===4&&s[1]===6) return { score:1400, name:'세륙' };
    const k = (m1+m2)%10;
    if (k===9) return { score:1009, name:'갑오(9끗)' };
    if (k===0) return { score:1000, name:'망통(0끗)' };
    return { score:1000+k, name:`${k}끗` };
}

// ── 블랙잭 ─────────────────────────────────────────────
const BJ_SUITS = ['♠','♥','♦','♣'];
const BJ_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function drawCard() {
    return { rank: BJ_RANKS[Math.floor(Math.random()*13)], suit: BJ_SUITS[Math.floor(Math.random()*4)] };
}
function cardStr(c) { return `${c.rank}${c.suit}`; }
function handStr(h) { return h.map(cardStr).join(' '); }
function calcBJ(hand) {
    let t=0, a=0;
    for (const c of hand) {
        if (c.rank==='A') { t+=11; a++; }
        else if (['J','Q','K'].includes(c.rank)) t+=10;
        else t+=parseInt(c.rank);
    }
    while (t>21&&a>0) { t-=10; a--; }
    return t;
}
function isBJ(hand) { return hand.length===2&&calcBJ(hand)===21; }
function dealerPlayBJ(hand) {
    while (calcBJ(hand)<17) hand.push(drawCard());
    return hand;
}
function judgeBJ(pH, dH, bet, isSplit) {
    const ps=calcBJ(pH), ds=calcBJ(dH);
    const pBJ=!isSplit&&isBJ(pH), dBJ=isBJ(dH);
    if (ps>21) return { type:'BUST', payout:-bet };
    if (pBJ&&!dBJ) return { type:'BLACKJACK', payout:Math.floor(bet*1.5) };
    if (pBJ&&dBJ) return { type:'PUSH', payout:0 };
    if (ds>21) return { type:'WIN', payout:bet };
    if (ps>ds) return { type:'WIN', payout:bet };
    if (ps<ds) return { type:'LOSE', payout:-bet };
    return { type:'PUSH', payout:0 };
}
function bjLabel(type) {
    return {BLACKJACK:'🃏 블랙잭!',WIN:'🏆 승리!',LOSE:'💸 패배',PUSH:'🤝 무승부',BUST:'💥 버스트'}[type]||type;
}

function advanceBJ(db, room, sender) {
    const s = blackjackSessions[room];
    if (!s) return '';
    const next = s.hands.findIndex((h,i)=>i>s.activeIdx&&!h.done);
    if (next!==-1) {
        s.activeIdx=next; s.canFirst=true;
        const h=s.hands[next];
        return `\n➡️ [${next+1}번째 패]\n🃏 ${handStr(h.cards)} (${calcBJ(h.cards)})\n💵 !히트 / !스탠드 / !더블다운`;
    }
    const user=ensureUser(db,sender);
    const allBust=s.hands.every(h=>calcBJ(h.cards)>21);
    if (!allBust) dealerPlayBJ(s.dealerHand);
    const ds=calcBJ(s.dealerHand);
    let msg=`\n\n🤖 딜러 패 공개: ${handStr(s.dealerHand)} (${ds})\n──────────────────\n`;
    let total=0;
    s.hands.forEach((h,i)=>{
        const bet=h.doubled?s.bet*2:s.bet;
        const j=judgeBJ(h.cards,s.dealerHand,bet,s.hands.length>1);
        total+=bet+j.payout;
        const prefix=s.hands.length>1?`[${i+1}번째] `:'';
        msg+=`${prefix}${handStr(h.cards)} (${calcBJ(h.cards)}) → ${bjLabel(j.type)} ${j.payout>=0?'+':''}${formatKRW(j.payout)}\n`;
        // 업적
        if (j.type==='WIN'||j.type==='BLACKJACK') user.stats.blackjack.wins=(user.stats.blackjack.wins||0)+1;
        else if (j.type==='LOSE'||j.type==='BUST') user.stats.blackjack.losses=(user.stats.blackjack.losses||0)+1;
    });
    // 수수료
    let netTotal=total; let feeMsg='';
    if (total>s.bet) {
        const profit=total-s.bet*s.hands.length;
        if (profit>0&&!s.feeWaived) {
            const {net,fee}=applyFee(profit,'blackjack');
            netTotal=s.bet*s.hands.length+net;
            feeMsg=`\n💸 수수료(${CONFIG.fees.blackjack}%): -${formatKRW(fee)}`;
        }
    }
    user.points+=netTotal;
    saveData(db);
    delete blackjackSessions[room];
    msg+=`──────────────────${feeMsg}\n💰 내 지갑: ${formatKRW(user.points)}`;
    return msg;
}

// ── 가챠 ───────────────────────────────────────────────
function rollGacha(boxType, user) {
    const boxCfg = CONFIG.gacha[boxType];
    if (!boxCfg) return null;
    const rates = { ...boxCfg.rates };

    // 신화반지 효과: 등급 확률 부스트
    const boost = sumItemEffect(user, 'gacha_boost');
    if (boost > 0) {
        const boostPer = boost / 100;
        // 낮은 등급에서 빼서 높은 등급에 추가
        const lowGrades = ['꽝','일반','희귀'];
        let totalBorrow = 0;
        for (const g of lowGrades) {
            const borrow = Math.min(rates[g]||0, (rates[g]||0)*boostPer);
            rates[g] = (rates[g]||0) - borrow;
            totalBorrow += borrow;
        }
        rates['신화'] = (rates['신화']||0) + totalBorrow;
    }

    const totalWeight = Object.values(rates).reduce((s,v)=>s+v,0);
    let r = Math.random()*totalWeight;
    let grade = '꽝';
    for (const [g,w] of Object.entries(rates)) {
        if (r<w) { grade=g; break; }
        r-=w;
    }

    const pool = GACHA_ITEM_POOL[grade];
    if (!pool||pool.length===0) return { grade:'꽝', item:GACHA_ITEM_POOL['꽝'][0] };
    const item = pool[Math.floor(Math.random()*pool.length)];
    return { grade, item };
}

const GRADE_EMOJI = { 꽝:'⬛', 일반:'⚪', 희귀:'🔵', 영웅:'🟣', 전설:'🟠', 신화:'🔴' };

// ── 퀴즈 보상 뽑기 ────────────────────────────────────
function rollQuizReward() {
    const pool = CONFIG.quiz.rewardPool;
    const total = pool.reduce((s,r)=>s+r.weight,0);
    let r = Math.random()*total;
    for (const item of pool) {
        if (r<item.weight) return item;
        r-=item.weight;
    }
    return pool[0];
}

// ── 코인 시세 변동 (타이머 기반) ───────────────────────
function updateCoinPrices(broadcastFn) {
    const maxChange = CONFIG.coin.maxChangePercent / 100;

    // 1분 전 예고 뉴스 (진짜/가짜 혼재)
    const targetCoin = COIN_NAMES[Math.floor(Math.random()*COIN_NAMES.length)];
    const isFake = Math.random() < 0.3; // 30% 확률로 가짜뉴스
    const isUp = Math.random() > 0.45;
    const poolKey = isUp ? (isFake?'up_fake':'up_real') : (isFake?'down_fake':'down_real');
    const pool = NEWS_POOL[targetCoin][poolKey] || NEWS_POOL[targetCoin][isUp?'up_real':'down_real'];
    const news = pool[Math.floor(Math.random()*pool.length)];
    const fakeTag = isFake ? ' 🔴[미확인 루머]' : ' 🟢[공식 속보]';

    const preview = `\n📰 [1분 후 시세 변동 예고]${fakeTag}\n${news}`;
    if (broadcastFn) broadcastFn(preview);

    // 1분 후 실제 변동
    setTimeout(() => {
        // 가짜뉴스면 반대 방향으로 움직이거나 무변동
        const actualUp = isFake ? !isUp : isUp;

        for (const key in COIN_MARKET) {
            COIN_MARKET[key].lastPrice = COIN_MARKET[key].currentPrice;
            let move = (Math.random()*maxChange*0.4) - (maxChange*0.2); // 기본 소폭 변동
            if (key === targetCoin) {
                move = actualUp
                    ? (Math.random()*maxChange*0.6)+0.05
                    : -(Math.random()*maxChange*0.5+0.05);
            }
            let nPrice = Math.floor(COIN_MARKET[key].currentPrice * (1+move));
            if (nPrice < 100) nPrice = 100;
            COIN_MARKET[key].currentPrice = nPrice;
        }
        saveMarket();

        let report = `\n📊 [시세 변동 완료]\n`;
        for (const key in COIN_MARKET) {
            const diff = COIN_MARKET[key].currentPrice - COIN_MARKET[key].lastPrice;
            report += `🪙 ${key}: ${formatKRW(COIN_MARKET[key].currentPrice)} (${diff>=0?'🔺+':'🔻'}${formatKRW(Math.abs(diff))})\n`;
        }
        if (broadcastFn) broadcastFn(report);
    }, 60000);
}

// ── 압류 처리 ──────────────────────────────────────────
function seizeAssets(db, name) {
    const user = ensureUser(db, name);
    const debt = calcLoanDebt(user.loan);
    if (debt <= 0) return;

    // 아이템 팔기
    user.gachaItems = [];
    user.boxes = {};
    user.items = [];

    // 코인 팔기
    for (const [n, h] of Object.entries(user.coins)) {
        if (h.count>0 && COIN_MARKET[n]) {
            user.points += COIN_MARKET[n].currentPrice * h.count;
            h.count=0; h.avgPrice=0;
        }
    }

    // 예금 강제 해지
    if (user.deposit && user.deposit.amount > 0) {
        user.points += user.deposit.amount + calcDepositInterest(user.deposit);
        user.deposit = { amount: 0, depositedAt: 0 };
    }

    // 직원 해고: RPG 개편으로 시스템 제거됨 (파티원은 압류 시 유지)

    // 빚 상환 후 마이너스 처리
    user.points -= debt;
    user.loan = { amount: 0, takenAt: 0 };
    user.seized = true;
    saveData(db);
}

// ═══════════════════════════════════════════════════════
// 8. 서버 시작
// ═══════════════════════════════════════════════════════
let broadcastRooms = []; // 뉴스 브로드캐스트 대상 방 목록
let broadcastCallback = null; // 방들에 메시지 보내는 함수

server.on('listening', () => {
    loadConfig();
    loadMarket();

    // 코인 자동 시세 변동 타이머
    const intervalMs = (CONFIG.coin.updateIntervalMinutes || 10) * 60000;
    setInterval(() => {
        if (broadcastCallback && broadcastRooms.length > 0) {
            updateCoinPrices((msg) => {
                for (const room of broadcastRooms) broadcastCallback(room, msg);
            });
        } else {
            updateCoinPrices(null);
        }
    }, intervalMs);

    // 대출 이자 압류 체크 (1시간마다)
    setInterval(() => {
        const db = loadData();
        let changed = false;
        for (const name of Object.keys(db)) {
            const u = ensureUser(db, name);
            if (u.loan.amount > 0) {
                const debt = calcLoanDebt(u.loan);
                const nw = calcNetWorth(u);
                if (debt > nw.total + u.points && !u.seized) {
                    seizeAssets(db, name);
                    changed = true;
                    if (broadcastCallback && broadcastRooms.length > 0) {
                        for (const room of broadcastRooms) {
                            broadcastCallback(room, `⚠️ [압류] ${name}님의 자산이 대출 미상환으로 압류되었습니다!`);
                        }
                    }
                }
            }
        }
        if (changed) saveData(db);
    }, 3600000);

    console.log('\n🎴 타짜봇 v3 가동 완료! (포트 ' + PORT + ')\n');
});

server.on('error', (err) => { console.error('소켓 에러:', err.message); });

server.on('message', (msg, rinfo) => {
    let data;
    try { data = JSON.parse(msg.toString('utf-8')); } catch { return; }
    if (!data || typeof data !== 'object') return;

    const room   = data.room;
    const sender = data.sender;
    const content = (data.msg == null ? '' : String(data.msg)).trim();
    if (!sender || !content || room == null) return;

    // 브로드캐스트 콜백 등록 (처음 메시지 받은 rinfo 기준으로 각 방에 보낼 수 있게)


    try {
        const db = loadData();
        const user = ensureUser(db, sender);

        // 잔액 최저 2000원 보장 — 코인/예금도 없을 때만 적용 (악용 방지)
        if (user.points < MIN_BALANCE) {
            const hasCoinValue = Object.values(user.coins || {}).some(h => (h.count||0) > 0);
            const hasDeposit   = (user.deposit && user.deposit.amount > 0);
            const hasLoan      = (user.loan && user.loan.amount > 0);
            if (!hasCoinValue && !hasDeposit && !hasLoan) {
                user.points = MIN_BALANCE;
                saveData(db);
            }
        }

        const reply = (text) => {
            const buf = Buffer.from(String(text), 'utf-8');
            server.send(buf, 0, buf.length, rinfo.port, rinfo.address);
        };

        // 브로드캐스트 콜백 설정 (뉴스용)
        if (!broadcastCallback) {
            broadcastCallback = (targetRoom, text) => {
                // 같은 방의 rinfo를 모르므로, 현재 방에만 보낼 수 있음
                // 실제 구현: 방별 rinfo 저장
            };
        }

        const parts = content.split(/\s+/);
        const cmd   = parts[0];
        const args  = parts.slice(1);

        // 압류 상태 게임 차단
        const GAME_CMDS = ['!섯다','!블랙잭','!바카라','!숫자맞추기','!대결신청'];
        if (user.seized && GAME_CMDS.includes(cmd)) {
            return reply('⛔ 자산이 압류된 상태에서는 게임을 할 수 없습니다. !대출조회 로 상태를 확인하세요.');
        }

        // ══════════════════════════════════════════════
        // 뉴스 ON/OFF (운영자만)
        // ══════════════════════════════════════════════
        if (cmd === '!뉴스켜기') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 운영자 전용 명령어입니다.');
            if (!activeNewsRooms.includes(room)) activeNewsRooms.push(room);
            return reply('📰 이 방의 코인 뉴스 자동 발송이 활성화되었습니다.');
        }
        if (cmd === '!뉴스끄기') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 운영자 전용 명령어입니다.');
            activeNewsRooms = activeNewsRooms.filter(r=>r!==room);
            return reply('🔕 이 방의 코인 뉴스 자동 발송이 비활성화되었습니다.');
        }

        // ══════════════════════════════════════════════
        // 운영자 명령어
        // ══════════════════════════════════════════════
        if (cmd === '!관리자지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자지급 [닉네임] [금액]');
            const target = ensureUser(db, args[0]);
            const amt = parseAmount(args[1]);
            if (isNaN(amt)) return reply('❌ 금액 오류');
            const before = target.points;
            target.points += amt;
            if (target.points < 0) target.points = 0;
            saveData(db);
            return reply(`🛡️ [지급 완료] ${args[0]}: ${formatKRW(before)} → ${formatKRW(target.points)}`);
        }

        if (cmd === '!관리자설정') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자설정 [닉네임] [금액]');
            const target = ensureUser(db, args[0]);
            const amt = parseAmount(args[1]);
            if (isNaN(amt)||amt<0) return reply('❌ 금액 오류');
            target.points = amt;
            saveData(db);
            return reply(`🛡️ [설정 완료] ${args[0]} → ${formatKRW(amt)}`);
        }

        if (cmd === '!관리자초기화') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 1) return reply('❌ !관리자초기화 [닉네임]');
            if (!userExists(db, args[0])) return reply(`❌ "${args[0]}" 유저 없음`);
            db[args[0]] = createDefaultUser();
            saveData(db);
            return reply(`🛡️ [초기화 완료] ${args[0]}`);
        }

        if (cmd === '!관리자파티지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자파티지급 [닉네임] [파티원이름] [수량(기본1)]\n예: !관리자파티지급 홍길동 김판돌 10\n예2: !관리자파티지급 홍길동 검은 지배자 1');
            const target = ensureUser(db, args[0]);
            const matched = matchPartyMemberFromArgs(args, 1);
            if (!matched) return reply(`❌ 존재하지 않는 파티원입니다.\n(가능: ${Object.keys(PARTY_MEMBERS).join(', ')})`);
            const memberName = matched.name;
            const qty = parseInt(args[matched.nextIdx] || '1', 10);
            if (isNaN(qty) || qty < 1) return reply('❌ 수량 오류');
            if (!target.partyMembers[memberName]) target.partyMembers[memberName] = { count: 0, level: 0 };
            target.partyMembers[memberName].count += qty;
            promoteParty(target);
            saveData(db);
            return reply(`🛡️ [파티원 지급] ${args[0]}에게 ${memberName} x${qty} 지급\n현재: +${target.partyMembers[memberName].level} / ${target.partyMembers[memberName].count}개 보유`);
        }

        if (cmd === '!관리자강화석지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자강화석지급 [닉네임] [수량]');
            const target = ensureUser(db, args[0]);
            const qty = parseInt(args[1], 10);
            if (isNaN(qty)) return reply('❌ 수량 오류');
            target.stones = (target.stones || 0) + qty;
            if (target.stones < 0) target.stones = 0;
            saveData(db);
            return reply(`🛡️ [강화석 지급] ${args[0]}: ${qty>=0?'+':''}${qty}\n현재: ${target.stones.toLocaleString()}개`);
        }

        if (cmd === '!관리자소울지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자소울지급 [닉네임] [수량]');
            const target = ensureUser(db, args[0]);
            const qty = parseInt(args[1], 10);
            if (isNaN(qty)) return reply('❌ 수량 오류');
            target.souls = (target.souls || 0) + qty;
            if (target.souls < 0) target.souls = 0;
            saveData(db);
            return reply(`🛡️ [소울 지급] ${args[0]}: ${qty>=0?'+':''}${qty}\n현재: ${target.souls.toLocaleString()}개`);
        }

        if (cmd === '!관리자장비지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 3) return reply('❌ !관리자장비지급 [닉네임] [부위] [등급] [수량(기본1)]\n(부위: 무기/방어구/방패/반지)\n(등급: 초급/중급/고급/영웅/전설/신화/태초)');
            const target = ensureUser(db, args[0]);
            const raw = SLOT_ALIASES[args[1]];
            const slotType = (raw === 'ring1' || raw === 'ring2') ? 'ring' : raw;
            if (!slotType) return reply('❌ 부위는 무기/방어구/방패/반지 중 하나여야 합니다.');
            const grade = args[2];
            if (!EQUIP_GRADES.includes(grade)) return reply(`❌ 존재하지 않는 등급: ${grade}\n(가능: ${EQUIP_GRADES.join(', ')})`);
            const qty = parseInt(args[3] || '1', 10);
            if (isNaN(qty) || qty < 1) return reply('❌ 수량 오류');
            for (let i = 0; i < qty; i++) target.equipmentInventory.push(createEquipmentItem(slotType, grade));
            saveData(db);
            return reply(`🛡️ [장비 지급] ${args[0]}에게 ${grade} ${args[1]} x${qty} 지급 완료 (인벤토리 확인: !장비인벤)`);
        }

        if (cmd === '!관리자마법지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !관리자마법지급 [닉네임] [마법ID] [수량(기본1)]\n예) !관리자마법지급 홍길동 fireball 10');
            const target = ensureUser(db, args[0]);
            const spellId = args[1];
            const mb = getMagicBook(spellId);
            if (!mb) return reply(`❌ 마법 ID 오류: ${spellId}\n(ID 목록: ${MAGIC_BOOKS.map(m=>m.id).join(', ')})`);
            const qty = parseInt(args[2] || '1', 10);
            if (isNaN(qty) || qty < 1) return reply('❌ 수량 오류');
            if (!target.spells) target.spells = [];
            for (let i = 0; i < qty; i++) target.spells.push(spellId);
            const evolMsgs = checkMagicEvolution(target);
            saveData(db);
            let msg = `🔮 [마법 지급] ${args[0]}에게 ${mb.element}${mb.name} × ${qty} 지급`;
            if (evolMsgs.length) msg += '\n' + evolMsgs.join('\n');
            return reply(msg);
        }

        if (cmd === '!관리자아이템지급') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            // !관리자아이템지급 [닉네임] [아이템타입] [수량]
            if (args.length < 2) return reply('❌ !관리자아이템지급 [닉네임] [아이템타입] [수량(기본1)]');
            const target = ensureUser(db, args[0]);
            const itemType = args[1];
            const qty = parseInt(args[2]||'1',10);
            // 모든 풀에서 해당 타입 찾기
            let found = null;
            for (const pool of Object.values(GACHA_ITEM_POOL)) {
                const it = pool.find(i=>i.type===itemType||i.name===itemType);
                if (it) { found=it; break; }
            }
            if (!found) return reply(`❌ "${itemType}" 아이템을 찾을 수 없습니다.`);
            for (let i=0;i<qty;i++) target.gachaItems.push({...found});
            saveData(db);
            return reply(`🛡️ [아이템 지급] ${args[0]}에게 [${found.name}] x${qty} 지급 완료`);
        }

        if (cmd === '!설정보기') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            const feeStr = Object.entries(CONFIG.fees).map(([k,v])=>`${k}:${v}%`).join(', ');
            return reply(
                `⚙️ [현재 설정]\n` +
                `─────────────────────\n` +
                `💸 수수료: ${feeStr}\n` +
                `🎲 섯다 딜러다이 최대확률: ${CONFIG.sutda.dealerDieMaxChance}%\n` +
                `🪙 코인 업데이트 주기: ${CONFIG.coin.updateIntervalMinutes}분\n` +
                `💰 대출 시간당 이자: ${CONFIG.loan.hourlyInterestRate}%\n` +
                `👔 직원 세율: ${CONFIG.employee.taxRate}%\n` +
                `📰 뉴스 운영자: ${CONFIG.newsAdmins.join(', ')}`
            );
        }

        if (cmd === '!설정') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args.length < 2) return reply('❌ !설정 [경로] [값]\n예: !설정 fees.sutda 3');
            const before = getConfigValue(args[0]);
            setConfigValue(args[0], args[1]);
            const after = getConfigValue(args[0]);
            return reply(`⚙️ [설정 변경] ${args[0]}: ${before} → ${after}`);
        }

        if (cmd === '!시즌초기화') {
            if (!ADMIN_NAMES.includes(sender)) return reply('❌ 권한 없음');
            if (args[0] !== '확인') return reply('⚠️ 시즌 초기화를 진행하려면 !시즌초기화 확인 을 입력하세요.\n모든 유저 데이터가 초기화됩니다!');
            const names = Object.keys(db);
            for (const n of names) db[n] = createDefaultUser();
            saveData(db);
            // 마켓도 초기화
            COIN_MARKET = JSON.parse(JSON.stringify(DEFAULT_COIN));
            saveMarket();
            return reply(`🏁 [시즌 초기화 완료]\n총 ${names.length}명의 데이터가 초기화되었습니다.\n새 시즌을 시작합니다!`);
        }

        // ══════════════════════════════════════════════
        // 도움말
        // ══════════════════════════════════════════════
        if (cmd === '!도움말') {
            return reply(
                '📜 [타짜봇v3]\n' +
                '━━━━━━━━━━━━━━━━━━━━\n' +
                '📊 !내정보 !내스탯 !내마법 !내스킬\n' +
                '   !파티원 !장비 !장비인벤 !내상자\n\n' +
                '🎰 게임: !섯다 !블랙잭 !바카라 !대결신청\n\n' +
                '📈 코인: !코인시세 !매수 !매도 !내코인\n\n' +
                '🏦 은행: !예금 !출금 !예금조회\n' +
                '   !대출 !상환 !대출조회\n\n' +
                '📦 상자: !상자목록 !상자구매 !상자열기\n' +
                '   !장비상자목록 !용병상자목록\n' +
                '   !강화석상자목록 !소울상자목록\n\n' +
                '🗡️ 장비: !장비장착 [이름or번호]\n' +
                '   !장비강화 [슬롯] !장비수리전체 !장비판매 [번호]\n\n' +
                '👥 파티: !파티편성 [이름...] !파티해제\n\n' +
                '🏕️ 사냥: !사냥터 !사냥시작 [곳] !사냥종료 !사냥현황\n\n' +
                '👹 레이드: !레이드목록 !레이드 [보스]\n' +
                '   전투: !공격 !강공 !방어 !회피 !방해 !후퇴\n' +
                '   마법: !마법1 !마법2 (슬롯 설정: !마법장착 1 [이름])\n\n' +
                '📖 스킬: !스킬목록 !스킬습득 [이름]\n' +
                '🔮 마법: !마법목록 !마법구매 !마법합성\n' +
                '   !마법장착 [1or2] [이름] !마법해제 [1or2]\n\n' +
                '🌌 !시즌정보\n' +
                '💡 금액: 숫자/1만/1.5억/1조/올인/하프'
            );
        }

        // ═════