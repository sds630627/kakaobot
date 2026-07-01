'use strict';

// index.js — 타짜봇 v3 (시즌제/가챠/업적/바카라/1:1주사위/은행/config.json)
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'users.json');
const MARKET_FILE = path.join(__dirname, 'market.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

const server = dgram.createSocket('udp4');

// ═══════════════════════════════════════════════════════
// 1. CONFIG 로드/저장
// ═══════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
    fees: { sutda: 5, blackjack: 3, baccarat: 5, numberGuess: 3, duel: 5 },
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
    loan: { maxRatio: 0.5, hourlyInterestRate: 3 },
    employee: { taxRate: 20 },
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

const DEFAULT_LUXURY = {
    '롤렉스 서브마리너':  { basePrice: 5  * MAN,  currentPrice: 5  * MAN,  type: '명품시계',  unit: MAN },
    '오메가 씨마스터':    { basePrice: 8  * MAN,  currentPrice: 8  * MAN,  type: '명품시계',  unit: MAN },
    '까르띠에 산토스':    { basePrice: 15 * MAN,  currentPrice: 15 * MAN,  type: '명품시계',  unit: MAN },
    '구찌 가방':          { basePrice: 3  * MAN,  currentPrice: 3  * MAN,  type: '명품백',    unit: MAN },
    '에르메스 버킨백':    { basePrice: 30 * MAN,  currentPrice: 30 * MAN,  type: '명품백',    unit: MAN },
    '루이비통 트렁크':    { basePrice: 20 * MAN,  currentPrice: 20 * MAN,  type: '명품백',    unit: MAN },
    '테슬라 모델3':       { basePrice: 55 * MAN,  currentPrice: 55 * MAN,  type: '전기차',    unit: 10 * MAN },
    '포르쉐 카이엔':      { basePrice: 120 * MAN, currentPrice: 120 * MAN, type: '스포츠카',  unit: 10 * MAN },
    '페라리 로마':        { basePrice: 300 * MAN, currentPrice: 300 * MAN, type: '슈퍼카',    unit: 10 * MAN },
    '람보르기니 우라칸':  { basePrice: 450 * MAN, currentPrice: 450 * MAN, type: '슈퍼카',    unit: 10 * MAN },
    '한강뷰 오피스텔':    { basePrice: 200 * MAN, currentPrice: 200 * MAN, type: '부동산',    unit: 10 * MAN },
    '강남 아파트':        { basePrice: 500 * MAN, currentPrice: 500 * MAN, type: '부동산',    unit: 10 * MAN },
    '제주도 단독주택':    { basePrice: 350 * MAN, currentPrice: 350 * MAN, type: '부동산',    unit: 10 * MAN },
    '개인 요트':          { basePrice: 800 * MAN, currentPrice: 800 * MAN, type: '레저',      unit: 50 * MAN },
    '프라이빗 제트':      { basePrice: EOK,        currentPrice: EOK,        type: '항공',      unit: 100 * MAN }
};

const DEFAULT_COIN = {
    '성빈코인': { currentPrice: 1000, lastPrice: 1000, desc: '하이리스크 코인' },
    '호근코인': { currentPrice: 1000, lastPrice: 1000, desc: '안정 추구형 코인' },
    '정재코인': { currentPrice: 1000, lastPrice: 1000, desc: '상장폐지 위험 잡코인' },
    '몰탈코인': { currentPrice: 1000, lastPrice: 1000, desc: '신생 다크호스 코인' },
    '펭즈코인': { currentPrice: 1000, lastPrice: 1000, desc: '커뮤니티 밈 코인' },
    '첨지코인': { currentPrice: 1000, lastPrice: 1000, desc: '큰손이 움직이는 코인' }
};

const EMPLOYEE_SHOP = {
    '박장호':   { hirePrice: 500  * MAN,          perMinute: 3000,     desc: '평범한 알바생' },
    '박성빈':   { hirePrice: 2000 * MAN,           perMinute: 10000,    desc: '성실한 직원' },
    '몰탈':     { hirePrice: 5000 * MAN,           perMinute: 25000,    desc: '눈빛이 매서운 신입' },
    '임정재':   { hirePrice: Math.round(1 * EOK),  perMinute: 50000,    desc: '능력있는 매니저' },
    '조호근':   { hirePrice: Math.round(3 * EOK),  perMinute: 150000,   desc: '베테랑 임원' },
    '펭즈':     { hirePrice: Math.round(10 * EOK), perMinute: 500000,   desc: '의문의 거상' },
    '워렌버핏': { hirePrice: Math.round(50 * EOK), perMinute: 2000000,  desc: '투자의 귀재' },
    '첨지':     { hirePrice: Math.round(100 * EOK),perMinute: 4000000,  desc: '소문 속의 큰손' },
    '일론머스크':{ hirePrice: Math.round(300 * EOK),perMinute: 10000000, desc: '괴짜 천재 사업가' }
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

// ═══════════════════════════════════════════════════════
// 3. 런타임 상태
// ═══════════════════════════════════════════════════════
let LUXURY_MARKET = {};
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

function loadMarket() {
    try {
        if (fs.existsSync(MARKET_FILE)) {
            const data = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
            LUXURY_MARKET = data.luxury || {};
            COIN_MARKET = data.coin || {};
            for (const [k, v] of Object.entries(DEFAULT_LUXURY)) {
                if (!LUXURY_MARKET[k]) LUXURY_MARKET[k] = JSON.parse(JSON.stringify(v));
            }
            for (const [k, v] of Object.entries(DEFAULT_COIN)) {
                if (!COIN_MARKET[k]) COIN_MARKET[k] = JSON.parse(JSON.stringify(v));
            }
            saveMarket();
            return;
        }
    } catch (e) {
        console.error('market.json 로드 실패:', e.message);
    }
    LUXURY_MARKET = JSON.parse(JSON.stringify(DEFAULT_LUXURY));
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
        points: 2000,
        lastCheckIn: '',
        items: [],
        luxuries: {},
        coins: {},
        employees: {},
        gachaItems: [],
        boxes: {},
        loan: { amount: 0, takenAt: 0 },
        seized: false,
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
    if (!u.luxuries || typeof u.luxuries !== 'object') u.luxuries = {};
    if (!u.coins || typeof u.coins !== 'object') u.coins = {};
    if (!u.employees || typeof u.employees !== 'object') u.employees = {};
    if (!Array.isArray(u.gachaItems)) u.gachaItems = [];
    if (!u.boxes || typeof u.boxes !== 'object') u.boxes = {};
    if (!u.loan || typeof u.loan !== 'object') u.loan = { amount: 0, takenAt: 0 };
    if (typeof u.seized !== 'boolean') u.seized = false;
    if (!u.stats || typeof u.stats !== 'object') u.stats = createDefaultUser().stats;
    for (const game of ['sutda','blackjack','baccarat','numberGuess','duel']) {
        if (!u.stats[game]) u.stats[game] = { wins: 0, losses: 0, draws: 0 };
    }

    for (const key of Object.keys(u.luxuries)) {
        u.luxuries[key] = normalizeHolding(u.luxuries[key]);
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

// 총자산 계산
function calcNetWorth(user) {
    let luxuryValue = 0;
    for (const [name, h] of Object.entries(user.luxuries || {})) {
        const count = h.count || 0;
        if (count > 0 && LUXURY_MARKET[name]) luxuryValue += LUXURY_MARKET[name].currentPrice * count;
    }
    let coinValue = 0;
    for (const [name, h] of Object.entries(user.coins || {})) {
        const count = h.count || 0;
        if (count > 0 && COIN_MARKET[name]) coinValue += COIN_MARKET[name].currentPrice * count;
    }
    let empEarning = 0;
    const now = Date.now();
    for (const [name, info] of Object.entries(user.employees || {})) {
        const emp = EMPLOYEE_SHOP[name];
        if (emp && info && typeof info.hiredAt === 'number') {
            const rawEarning = Math.floor((now - info.hiredAt) / 60000) * emp.perMinute;
            const taxRate = CONFIG.employee.taxRate / 100;
            empEarning += Math.floor(rawEarning * (1 - taxRate));
        }
    }
    const debt = calcLoanDebt(user.loan);
    return {
        cash: user.points,
        luxuryValue,
        coinValue,
        empEarning,
        debt,
        total: user.points + luxuryValue + coinValue + empEarning - debt
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

// 사치품 가격 변동 (unit 기반 라운딩)
function roundToUnit(price, unit) {
    return Math.round(price / unit) * unit;
}

// 번호→이름 매핑
function getLuxuryList() { return Object.entries(LUXURY_MARKET); }
function resolveLuxuryName(arg) {
    const list = getLuxuryList();
    if (/^\d+$/.test(arg)) {
        const idx = parseInt(arg, 10) - 1;
        return (idx >= 0 && idx < list.length) ? list[idx][0] : null;
    }
    return LUXURY_MARKET[arg] ? arg : null;
}

function getEmployeeList() { return Object.entries(EMPLOYEE_SHOP); }
function resolveEmployeeName(arg) {
    const list = getEmployeeList();
    if (/^\d+$/.test(arg)) {
        const idx = parseInt(arg, 10) - 1;
        return (idx >= 0 && idx < list.length) ? list[idx][0] : null;
    }
    return EMPLOYEE_SHOP[arg] ? arg : null;
}

function resolveOwnedEmployee(user, arg) {
    const owned = Object.keys(user.employees || {});
    if (/^\d+$/.test(arg)) {
        const idx = parseInt(arg, 10) - 1;
        return (idx >= 0 && idx < owned.length) ? owned[idx] : null;
    }
    return owned.includes(arg) ? arg : null;
}

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

        // 명품 시세도 소폭 변동 (unit 단위로 반올림)
        for (const key in LUXURY_MARKET) {
            const item = LUXURY_MARKET[key];
            const change = (Math.random()*0.1)-0.05;
            let nPrice = item.currentPrice * (1+change);
            const floor = item.basePrice*0.5, cap=item.basePrice*2;
            nPrice = Math.max(floor, Math.min(cap, nPrice));
            item.currentPrice = roundToUnit(nPrice, item.unit);
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

    // 명품 팔기 (10% 수수료)
    for (const [n, h] of Object.entries(user.luxuries)) {
        if (h.count>0 && LUXURY_MARKET[n]) {
            user.points += Math.floor(LUXURY_MARKET[n].currentPrice * 0.9 * h.count);
            h.count=0; h.avgPrice=0;
        }
    }

    // 코인 팔기
    for (const [n, h] of Object.entries(user.coins)) {
        if (h.count>0 && COIN_MARKET[n]) {
            user.points += COIN_MARKET[n].currentPrice * h.count;
            h.count=0; h.avgPrice=0;
        }
    }

    // 직원 해고 (퇴직금 10%만)
    for (const [n] of Object.entries(user.employees)) {
        const emp = EMPLOYEE_SHOP[n];
        if (emp) user.points += Math.floor(emp.hirePrice*0.1);
    }
    user.employees = {};

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
            LUXURY_MARKET = JSON.parse(JSON.stringify(DEFAULT_LUXURY));
            COIN_MARKET = JSON.parse(JSON.stringify(DEFAULT_COIN));
            saveMarket();
            return reply(`🏁 [시즌 초기화 완료]\n총 ${names.length}명의 데이터가 초기화되었습니다.\n새 시즌을 시작합니다!`);
        }

        // ══════════════════════════════════════════════
        // 도움말
        // ══════════════════════════════════════════════
        if (cmd === '!도움말') {
            return reply(
                '📜 [타짜봇 v3 가이드]\n' +
                '━━━━━━━━━━━━━━━━━━━━\n\n' +
                '📊 [내 정보]\n' +
                ' !내정보 — 현금·자산 요약\n' +
                ' !내아이템 — 보유 아이템\n' +
                ' !내코인 — 코인 현황\n' +
                ' !내사치품 — 명품·차량 현황\n' +
                ' !내직원 — 직원 현황\n' +
                ' !랭킹 — 자산 순위\n\n' +
                '🎰 [게임]\n' +
                ' !섯다 [금액] — 섯다 시작\n' +
                ' !블랙잭 [금액] — 블랙잭\n' +
                ' !바카라 [플레이어/뱅커/타이] [금액] — 바카라\n' +
                ' !숫자맞추기 [개수] — 숫자맞추기 개설\n' +
                ' !숫자배팅 [금액] [숫자] — 참여\n' +
                ' !대결신청 [닉네임] [금액] — 1:1주사위\n\n' +
                '📦 [상자]\n' +
                ' !상자목록 — 구매 가능한 상자 종류\n' +
                ' !상자구매 [종류] [수량]\n' +
                ' !상자열기 [종류] [수량]\n' +
                ' !내상자 — 보유 상자 목록\n\n' +
                '📈 [거래소]\n' +
                ' !코인시세 — 코인 시세 확인\n' +
                ' !매수 [코인명] [금액or수량or풀]\n' +
                ' !매도 [코인명] [금액or수량or풀]\n\n' +
                '🏪 [사치품]\n' +
                ' !사치품시세 — 명품·차량 시세\n' +
                ' !구매 [번호or이름] — 사치품 구매\n' +
                ' !판매 [번호or이름] — 사치품 판매\n' +
                ' !모두팔기 — 전체 사치품 매각\n\n' +
                '👔 [직원]\n' +
                ' !직원목록 — 채용 가능 직원\n' +
                ' !직원채용 [번호or이름]\n' +
                ' !직원수익 — 미정산 수익 확인\n' +
                ' !직원출금 — 수익 정산\n' +
                ' !직원해고 [번호or이름]\n\n' +
                '🏦 [은행]\n' +
                ' !대출 [금액] — 대출 (자산 50% 한도)\n' +
                ' !상환 [금액or전액] — 대출 상환\n' +
                ' !대출조회 — 현재 대출 현황\n\n' +
                '💡 [금액 입력]\n' +
                ' 숫자, 1만, 1.5억, 1조 모두 가능\n' +
                ' 배팅: 올인/하프/삥/따당'
            );
        }

        // ══════════════════════════════════════════════
        // 출석
        // ══════════════════════════════════════════════
        if (cmd === '!출석') {
            const today = new Date().toISOString().split('T')[0];
            if (user.lastCheckIn === today) return reply('⚠️ 오늘 이미 출석했습니다.');
            user.points += 2000;
            user.lastCheckIn = today;
            saveData(db);
            return reply(`🎉 [출석 완료]\n💵 지급: +2,000원\n💰 잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // 내 정보 (분리된 명령어)
        // ══════════════════════════════════════════════
        if (cmd === '!내정보') {
            const nw = calcNetWorth(user);
            const achLines = [];
            for (const [game, levels] of Object.entries(ACHIEVEMENTS)) {
                const lvl = getAchievementLevel(user, game);
                if (lvl) achLines.push(`${lvl.title}`);
            }
            const title = displayName(user, sender);
            const debt = calcLoanDebt(user.loan);
            return reply(
                `${title}\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `💰 현금: ${formatKRW(user.points)}\n` +
                `📊 명품가치: ${formatKRW(nw.luxuryValue)}\n` +
                `🪙 코인가치: ${formatKRW(nw.coinValue)}\n` +
                `👔 미정산수익: ${formatKRW(nw.empEarning)}\n` +
                (debt>0 ? `🏦 대출잔액: -${formatKRW(debt)}\n` : '') +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `💎 총자산: ${formatKRW(nw.total)}\n` +
                (achLines.length>0 ? `🏆 업적: ${achLines.join(' / ')}` : '')
            );
        }

        if (cmd === '!내아이템') {
            if (!user.gachaItems||user.gachaItems.length===0) return reply('❌ 보유한 아이템이 없습니다.\n!상자열기 로 획득해보세요.');
            const grouped = {};
            for (const it of user.gachaItems) {
                if (!grouped[it.name]) grouped[it.name]={...it,count:0};
                grouped[it.name].count++;
            }
            let msg = `🎒 [${sender}님의 아이템]\n─────────────────────\n`;
            for (const [,it] of Object.entries(grouped)) {
                msg += `${GRADE_EMOJI[it.grade]||'⚪'} [${it.grade}] ${it.name} x${it.count}\n   ㄴ ${it.desc}\n`;
            }
            return reply(msg);
        }

        if (cmd === '!내코인') {
            let msg = `🪙 [${sender}님의 코인]\n─────────────────────\n`;
            let any = false;
            for (const [name, h] of Object.entries(user.coins)) {
                if (!h||h.count<=0) continue;
                any = true;
                const cur = COIN_MARKET[name]?.currentPrice || 0;
                const rate = formatChangeRate(h.avgPrice, cur);
                msg += `${name}: ${h.count.toLocaleString()}개\n`;
                msg += `   평단 ${formatKRW(h.avgPrice)} / 현재 ${formatKRW(cur)}${rate}\n`;
            }
            if (!any) msg += '보유 코인 없음';
            return reply(msg);
        }

        if (cmd === '!내사치품') {
            let msg = `👑 [${sender}님의 사치품]\n─────────────────────\n`;
            let any = false;
            for (const [name, h] of Object.entries(user.luxuries)) {
                if (!h||h.count<=0) continue;
                any = true;
                const cur = LUXURY_MARKET[name]?.currentPrice || 0;
                const rate = formatChangeRate(h.avgPrice, cur);
                msg += `${name} x${h.count}\n`;
                msg += `   평단 ${formatKRW(h.avgPrice)} / 현재 ${formatKRW(cur)}${rate}\n`;
            }
            if (!any) msg += '보유 사치품 없음';
            return reply(msg);
        }

        if (cmd === '!내직원') {
            const empNames = Object.keys(user.employees||{});
            if (empNames.length===0) return reply('❌ 고용된 직원이 없습니다. !직원목록 으로 확인해보세요.');
            const now=Date.now();
            const taxRate=CONFIG.employee.taxRate/100;
            let msg=`👔 [${sender}님의 직원 현황]\n─────────────────────\n`;
            let total=0;
            empNames.forEach((name,i)=>{
                const emp=EMPLOYEE_SHOP[name], info=user.employees[name];
                if (!emp||!info) return;
                const rawEarn=Math.floor((now-info.hiredAt)/60000)*emp.perMinute;
                const netEarn=Math.floor(rawEarn*(1-taxRate));
                const mins=Math.floor((now-info.hiredAt)/60000);
                total+=netEarn;
                msg+=`${i+1}. ${name} — 근무 ${mins}분\n   미정산 +${formatKRW(netEarn)} (세후, 세율 ${CONFIG.employee.taxRate}%)\n`;
            });
            msg+=`─────────────────────\n총 미정산: ${formatKRW(total)}\n!직원출금 으로 수령`;
            return reply(msg);
        }

        if (cmd === '!내상자') {
            const boxes = user.boxes||{};
            const has = Object.entries(boxes).filter(([,n])=>n>0);
            if (has.length===0) return reply('❌ 보유한 상자가 없습니다. !상자목록 으로 구매해보세요.');
            let msg=`📦 [${sender}님의 상자]\n─────────────────────\n`;
            for (const [type,cnt] of has) msg+=`${type}: ${cnt}개\n`;
            msg+='─────────────────────\n!상자열기 [종류] [수량] 으로 개봉';
            return reply(msg);
        }

        // ══════════════════════════════════════════════
        // 랭킹
        // ══════════════════════════════════════════════
        if (cmd === '!랭킹') {
            const all = Object.keys(db).filter(n=>userExists(db,n));
            const ranked = all.map(n=>{const u=ensureUser(db,n);return{name:n,nw:calcNetWorth(u)};})
                .filter(r=>r.nw.total>0)
                .sort((a,b)=>b.nw.total-a.nw.total)
                .slice(0,10);
            if (ranked.length===0) return reply('❌ 자산이 있는 유저가 없습니다.');
            const medals=['🥇','🥈','🥉'];
            let board='🏆 [총자산 랭킹 TOP 10]\n─────────────────────\n';
            ranked.forEach((r,i)=>{
                const u=ensureUser(db,r.name);
                const title=displayName(u,r.name);
                board+=`${medals[i]||`${i+1}.`} ${title}: ${formatKRW(r.nw.total)}\n`;
            });
            return reply(board);
        }

        // ══════════════════════════════════════════════
        // 송금
        // ══════════════════════════════════════════════
        if (cmd === '!송금') {
            if (args.length<2) return reply('❌ !송금 [닉네임] [금액 or 전재산]');
            const target=args[0];
            const amt=args[1]==='전재산'?user.points:parseAmount(args[1]);
            if (isNaN(amt)||amt<=0||sender===target||user.points<amt||!userExists(db,target))
                return reply(`❌ 송금 실패. (보유: ${formatKRW(user.points)})`);
            const recv=ensureUser(db,target);
            user.points-=amt; recv.points+=amt;
            saveData(db);
            return reply(`💸 [송금 완료]\n대상: ${target}\n금액: -${formatKRW(amt)}\n내 잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // 사치품 시세 / 구매 / 판매
        // ══════════════════════════════════════════════
        if (cmd === '!사치품시세') {
            let m = '🏪 [사치품 시세]\n─────────────────────\n';
            getLuxuryList().forEach(([name, info], idx) => {
                m += `${idx+1}. ${name} [${info.type}]\n   ${formatKRW(info.currentPrice)}\n`;
            });
            m += '\n!구매 [번호] / !판매 [번호]';
            return reply(m);
        }

        if (cmd === '!구매') {
            if (args.length<1) return reply('❌ !구매 [번호or이름]');
            const luxName = resolveLuxuryName(args[0]);
            if (!luxName) return reply('❌ 존재하지 않는 사치품입니다.');
            const item = LUXURY_MARKET[luxName];
            if (user.points < item.currentPrice)
                return reply(`❌ 자금 부족. 필요: ${formatKRW(item.currentPrice)} (보유: ${formatKRW(user.points)})`);
            user.points -= item.currentPrice;
            if (!user.luxuries[luxName]) user.luxuries[luxName]={count:0,avgPrice:0};
            updateAvgBuy(user.luxuries[luxName], 1, item.currentPrice);
            saveData(db);
            return reply(`🏎️ [구매 완료]\n${luxName}\n지출: -${formatKRW(item.currentPrice)}\n평단: ${formatKRW(user.luxuries[luxName].avgPrice)}\n잔액: ${formatKRW(user.points)}`);
        }

        if (cmd === '!판매') {
            if (args.length<1) return reply('❌ !판매 [번호or이름]');
            const luxName = resolveLuxuryName(args[0]);
            if (!luxName) return reply('❌ 존재하지 않는 사치품입니다.');
            const h = user.luxuries[luxName];
            if (!h||h.count<=0) return reply('❌ 보유 자산이 없습니다.');
            const sell = Math.floor(LUXURY_MARKET[luxName].currentPrice * 0.9);
            h.count -= 1;
            if (h.count===0) h.avgPrice=0;
            user.points += sell;
            saveData(db);
            return reply(`💸 [판매 완료]\n${luxName}\n환급: +${formatKRW(sell)} (수수료 10%)\n잔액: ${formatKRW(user.points)}`);
        }

        if (cmd === '!모두팔기') {
            const owned = Object.entries(user.luxuries).filter(([,h])=>h.count>0);
            if (owned.length===0) return reply('❌ 보유한 사치품이 없습니다.');
            let total=0, detail='';
            for (const [name, h] of owned) {
                const item = LUXURY_MARKET[name];
                const unit = item ? Math.floor(item.currentPrice*0.9) : 0;
                const sub = unit * h.count;
                total += sub;
                detail += `➔ ${name} x${h.count} → +${formatKRW(sub)}\n`;
                user.luxuries[name] = {count:0,avgPrice:0};
            }
            user.points += total;
            saveData(db);
            return reply(`💸 [일괄 매각]\n─────────────────────\n${detail}─────────────────────\n총 환급: +${formatKRW(total)} (수수료 10%)\n잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // 코인 시세 / 매수 / 매도
        // ══════════════════════════════════════════════
        if (cmd === '!코인시세') {
            let m = '📈 [코인 시세]\n─────────────────────\n';
            for (const [name, info] of Object.entries(COIN_MARKET)) {
                const diff = info.currentPrice - info.lastPrice;
                m += `🪙 ${name}: ${formatKRW(info.currentPrice)} (${diff>=0?'🔺+':'🔻'}${formatKRW(Math.abs(diff))})\n`;
            }
            m += `\n다음 시세 변동까지 최대 ${CONFIG.coin.updateIntervalMinutes}분`;
            return reply(m);
        }

        if (cmd === '!매수' || cmd === '!매도') {
            const isBuy = cmd === '!매수';
            if (args.length<2) return reply(`❌ 양식: !${isBuy?'매수':'매도'} [코인명] [금액or수량or풀]`);
            const coinName = args[0];
            if (!COIN_MARKET[coinName]) return reply('❌ 존재하지 않는 코인입니다.');
            const price = COIN_MARKET[coinName].currentPrice;
            if (!user.coins[coinName]) user.coins[coinName]={count:0,avgPrice:0};
            const h = user.coins[coinName];

            let amount;
            const arg = args[1];
            if (isFullKeyword(arg)) {
                amount = isBuy ? Math.floor(user.points/price) : h.count;
            } else {
                const parsed = parseAmount(arg);
                if (isNaN(parsed)) return reply('❌ 수량 또는 금액을 입력하세요.');
                const hasUnit = /[만억조]/.test(arg);
                if (hasUnit) amount = Math.floor(parsed / price);
                else amount = parsed;
            }

            if (isNaN(amount)||amount<=0) return reply(isBuy?`❌ 매수 가능 수량 없음 (보유: ${formatKRW(user.points)})`:'❌ 매도할 수량 없음');

            if (isBuy) {
                const cost = price*amount;
                if (user.points<cost) return reply(`❌ 자금 부족. 필요: ${formatKRW(cost)}`);
                user.points -= cost;
                updateAvgBuy(h, amount, price);
                saveData(db);
                return reply(`🪙 [매수]\n${coinName} ${amount.toLocaleString()}개\n단가 ${formatKRW(price)} / 총 -${formatKRW(cost)}\n평단 ${formatKRW(h.avgPrice)}\n잔액: ${formatKRW(user.points)}`);
            } else {
                if (h.count<amount) return reply(`❌ 보유 부족 (보유: ${h.count.toLocaleString()}개)`);
                const ret = price*amount;
                h.count -= amount;
                if (h.count===0) h.avgPrice=0;
                user.points += ret;
                saveData(db);
                return reply(`📉 [매도]\n${coinName} ${amount.toLocaleString()}개\n단가 ${formatKRW(price)} / 총 +${formatKRW(ret)}\n잔액: ${formatKRW(user.points)}`);
            }
        }

        // ══════════════════════════════════════════════
        // 직원 목록 / 채용 / 수익 / 해고
        // ══════════════════════════════════════════════
        if (cmd === '!직원목록') {
            let m = '👔 [채용 가능한 직원]\n─────────────────────\n';
            getEmployeeList().forEach(([name, info], i) => {
                m += `${i+1}. ${name} — 영입가 ${formatKRW(info.hirePrice)}\n   분당 ${formatKRW(info.perMinute)} (세율 ${CONFIG.employee.taxRate}%)\n   ㄴ ${info.desc}\n`;
            });
            m += '\n!직원채용 [번호or이름]';
            return reply(m);
        }

        if (cmd === '!직원채용') {
            if (args.length<1) return reply('❌ !직원채용 [번호or이름]');
            const name = resolveEmployeeName(args[0]);
            if (!name) return reply('❌ 존재하지 않는 직원');
            if (user.employees[name]) return reply(`⚠️ ${name}님은 이미 채용 중`);
            const emp = EMPLOYEE_SHOP[name];
            if (user.points<emp.hirePrice) return reply(`❌ 자금 부족 (필요: ${formatKRW(emp.hirePrice)})`);
            user.points -= emp.hirePrice;
            user.employees[name] = {hiredAt: Date.now()};
            saveData(db);
            return reply(`👔 [채용] ${name}\n영입가: -${formatKRW(emp.hirePrice)}\n분당 수익: ${formatKRW(emp.perMinute)}\n잔액: ${formatKRW(user.points)}`);
        }

        if (cmd === '!직원수익') {
            const empNames = Object.keys(user.employees||{});
            if (empNames.length===0) return reply('❌ 고용된 직원이 없습니다.');
            const now=Date.now();
            const taxRate=CONFIG.employee.taxRate/100;
            let m='👔 [미정산 수익]\n─────────────────────\n';
            let total=0;
            empNames.forEach((n,i)=>{
                const emp=EMPLOYEE_SHOP[n], info=user.employees[n];
                const raw=Math.floor((now-info.hiredAt)/60000)*emp.perMinute;
                const net=Math.floor(raw*(1-taxRate));
                total+=net;
                m+=`${i+1}. ${n}: +${formatKRW(net)}\n`;
            });
            m+=`─────────────────────\n총: ${formatKRW(total)}`;
            return reply(m);
        }

        if (cmd === '!직원출금') {
            const empNames = Object.keys(user.employees||{});
            if (empNames.length===0) return reply('❌ 고용된 직원이 없습니다.');
            const now=Date.now();
            const taxRate=CONFIG.employee.taxRate/100;
            let total=0, detail='';
            empNames.forEach(n=>{
                const emp=EMPLOYEE_SHOP[n], info=user.employees[n];
                const raw=Math.floor((now-info.hiredAt)/60000)*emp.perMinute;
                const net=Math.floor(raw*(1-taxRate));
                total+=net;
                detail+=`➔ ${n}: +${formatKRW(net)}\n`;
                user.employees[n].hiredAt = now;
            });
            if (total<=0) return reply('❌ 정산할 수익이 없습니다.');
            user.points += total;
            saveData(db);
            return reply(`💵 [출금 완료]\n─────────────────────\n${detail}─────────────────────\n총 수령: +${formatKRW(total)}\n잔액: ${formatKRW(user.points)}`);
        }

        if (cmd === '!직원해고') {
            if (args.length<1) return reply('❌ !직원해고 [번호or이름]');
            const name = resolveOwnedEmployee(user, args[0]);
            if (!name) return reply('❌ 보유하지 않은 직원');
            const emp = EMPLOYEE_SHOP[name];
            const info = user.employees[name];
            const now = Date.now();
            const raw = Math.floor((now-info.hiredAt)/60000)*emp.perMinute;
            const netEarn = Math.floor(raw*(1-CONFIG.employee.taxRate/100));
            const severance = Math.floor(emp.hirePrice*0.1); // 10% 지급
            delete user.employees[name];
            user.points += netEarn + severance;
            saveData(db);
            return reply(`👋 [해고 처리] ${name}\n미정산 수익: +${formatKRW(netEarn)}\n퇴직금: +${formatKRW(severance)} (영입가의 10%만 지급)\n잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // 상자 시스템
        // ══════════════════════════════════════════════
        if (cmd === '!상자목록') {
            let m = '📦 [랜덤상자 목록]\n─────────────────────\n';
            for (const [type, cfg] of Object.entries(CONFIG.gacha)) {
                m += `${type} — ${formatKRW(cfg.price)}\n`;
                const rateStr = Object.entries(cfg.rates)
                    .filter(([,v])=>v>0)
                    .map(([g,v])=>`${g} ${v}%`).join(', ');
                m += `   ㄴ ${rateStr}\n`;
            }
            m += '\n!상자구매 [종류] [수량]\n!상자열기 [종류] [수량]';
            return reply(m);
        }

        if (cmd === '!상자구매') {
            if (args.length<1) return reply('❌ !상자구매 [종류] [수량(기본1)]');
            const boxType = args[0];
            const qty = parseInt(args[1]||'1',10);
            if (!CONFIG.gacha[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty)||qty<1||qty>100) return reply('❌ 수량은 1~100');
            const cost = CONFIG.gacha[boxType].price * qty;
            if (user.points<cost) return reply(`❌ 자금 부족 (필요: ${formatKRW(cost)})`);
            user.points -= cost;
            user.boxes[boxType] = (user.boxes[boxType]||0) + qty;
            saveData(db);
            return reply(`📦 [구매] ${boxType} x${qty}\n지출: -${formatKRW(cost)}\n보유: ${user.boxes[boxType]}개\n잔액: ${formatKRW(user.points)}\n\n!상자열기 ${boxType} ${qty} 로 개봉`);
        }

        if (cmd === '!상자열기') {
            if (args.length<1) return reply('❌ !상자열기 [종류] [수량(기본1)]');
            const boxType = args[0];
            const qty = parseInt(args[1]||'1',10);
            if (!CONFIG.gacha[boxType]) return reply(`❌ 존재하지 않는 상자: ${boxType}`);
            if (isNaN(qty)||qty<1||qty>100) return reply('❌ 수량은 1~100');
            if ((user.boxes[boxType]||0) < qty) return reply(`❌ ${boxType} 부족 (보유: ${user.boxes[boxType]||0}개)`);

            user.boxes[boxType] -= qty;
            const results = [];
            for (let i=0; i<qty; i++) {
                const r = rollGacha(boxType, user);
                if (!r) continue;
                results.push(r);
                // 현금 아이템은 즉시 지급, 나머지는 보관함에
                if (r.item.type === 'cash') {
                    user.points += r.item.value;
                } else if (r.item.type !== 'nothing') {
                    user.gachaItems.push({name:r.item.name, type:r.item.type, value:r.item.value, grade:r.grade, desc:r.item.desc});
                }
            }
            saveData(db);

            const gradeOrder={신화:0,전설:1,영웅:2,희귀:3,일반:4,꽝:5};
            results.sort((a,b)=>gradeOrder[a.grade]-gradeOrder[b.grade]);

            let m = `📦 [${boxType} 개봉] x${qty}\n─────────────────────\n`;
            results.forEach(r => {
                m += `${GRADE_EMOJI[r.grade]||'⚪'} [${r.grade}] ${r.item.name}\n   ㄴ ${r.item.desc}\n`;
            });
            const best = results[0]?.grade;
            if (best==='신화') m+='\n🎊🎊🎊 신화 등급 획득! 🎊🎊🎊\n';
            else if (best==='전설') m+='\n✨ 전설 등급 획득!\n';
            m += `─────────────────────\n잔액: ${formatKRW(user.points)}`;
            return reply(m);
        }

        // ══════════════════════════════════════════════
        // 은행 (대출/상환)
        // ══════════════════════════════════════════════
        if (cmd === '!대출') {
            if (args.length<1) return reply('❌ !대출 [금액]');
            const amt = parseAmount(args[0]);
            if (isNaN(amt)||amt<=0) return reply('❌ 금액 오류');
            if (user.loan.amount>0) return reply(`❌ 이미 대출 중입니다. 현재 채무: ${formatKRW(calcLoanDebt(user.loan))}`);
            const nw = calcNetWorth(user);
            const maxLoan = Math.floor((nw.total + calcLoanDebt(user.loan)) * CONFIG.loan.maxRatio);
            if (amt > maxLoan) return reply(`❌ 대출 한도 초과. 최대: ${formatKRW(maxLoan)} (총자산의 ${CONFIG.loan.maxRatio*100}%)`);
            user.loan = { amount: amt, takenAt: Date.now() };
            user.points += amt;
            saveData(db);
            return reply(`🏦 [대출 성공]\n대출액: +${formatKRW(amt)}\n시간당 이자: ${CONFIG.loan.hourlyInterestRate}%\n잔액: ${formatKRW(user.points)}\n\n⚠️ 미상환 시 자산 압류될 수 있습니다.`);
        }

        if (cmd === '!상환') {
            if (user.loan.amount<=0) return reply('❌ 상환할 대출이 없습니다.');
            const debt = calcLoanDebt(user.loan);
            let amt;
            if (args[0]==='전액'||args[0]==='전액상환') amt = debt;
            else amt = parseAmount(args[0]||'');
            if (isNaN(amt)||amt<=0) return reply('❌ !상환 [금액or전액]');
            if (amt > debt) amt = debt;
            if (user.points < amt) return reply(`❌ 자금 부족. 필요: ${formatKRW(amt)} (보유: ${formatKRW(user.points)})`);
            user.points -= amt;
            const remaining = debt - amt;
            if (remaining <= 0) {
                user.loan = { amount: 0, takenAt: 0 };
                saveData(db);
                return reply(`✅ [전액 상환 완료]\n상환액: -${formatKRW(amt)}\n잔액: ${formatKRW(user.points)}`);
            } else {
                // 부분상환: 이자율 재계산을 위해 원금 재설정
                user.loan.amount = remaining;
                user.loan.takenAt = Date.now();
                saveData(db);
                return reply(`💵 [부분 상환]\n상환액: -${formatKRW(amt)}\n남은 채무: ${formatKRW(remaining)}\n잔액: ${formatKRW(user.points)}`);
            }
        }

        if (cmd === '!대출조회') {
            if (user.loan.amount<=0) return reply('✅ 현재 대출 없음');
            const debt = calcLoanDebt(user.loan);
            const hours = ((Date.now() - user.loan.takenAt) / 3600000).toFixed(1);
            return reply(
                `🏦 [대출 현황]\n─────────────────────\n` +
                `원금: ${formatKRW(user.loan.amount)}\n` +
                `경과 시간: ${hours}시간\n` +
                `시간당 이자율: ${CONFIG.loan.hourlyInterestRate}%\n` +
                `현재 채무: ${formatKRW(debt)}\n` +
                `이자: ${formatKRW(debt - user.loan.amount)}\n` +
                (user.seized ? '⛔ 압류 상태' : '')
            );
        }

        // ══════════════════════════════════════════════
        // 섯다 (새 룰: 1패-배팅-2패-배팅)
        // ══════════════════════════════════════════════
        if (cmd === '!섯다') {
            if (gameSessions[room]) return reply('⚠️ 이미 진행 중인 섯다가 있습니다.');
            if (args.length<1) return reply(`❌ !섯다 [금액] (보유: ${formatKRW(user.points)})`);
            const baseAmt = resolveBetAmount(args[0], user.points);
            if (isNaN(baseAmt)||baseAmt<=0||user.points<baseAmt) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);

            // 광땡 보정 (신화템)
            let shuffled = [...DECK].sort(()=>Math.random()-0.5);
            const gwBonus = sumItemEffect(user, 'gwangddaeng');
            if (gwBonus>0 && Math.random() < gwBonus/100) {
                // 광땡 강제 세팅
                const combos = [[{m:3,name:'3광'},{m:8,name:'8광'}],[{m:1,name:'1광'},{m:3,name:'3광'}],[{m:1,name:'1광'},{m:8,name:'8광'}]];
                const combo = combos[Math.floor(Math.random()*combos.length)];
                shuffled[0]=combo[0]; shuffled[1]=combo[1];
            }
            const [p1,p2,d1,d2] = shuffled;

            user.points -= baseAmt;
            gameSessions[room] = {
                player: sender,
                baseBet: baseAmt,
                totalBet: baseAmt, // 지금까지 걸린 총액
                stage: 1,          // 1: 첫패 배팅단계, 2: 두번째패 배팅단계
                pCards: [p1, p2],
                dCards: [d1, d2],
                pResult: evaluateHand(p1,p2),
                dResult: evaluateHand(d1,d2),
                cardChangesLeft: sumItemEffect(user,'card_change'), // 아이템에서 온 교체권
                feeWaived: consumeItem(user,'omniscient') || consumeItem(user,'fee_waive'),
                dealerSealed: consumeItem(user,'dealer_seal')
            };
            saveData(db);

            return reply(
                `🎴 [섯다 시작]\n─────────────────────\n` +
                `👤 ${sender}\n` +
                `🃏 첫 번째 패: [ ${p1.name} ]\n` +
                `💰 기본 배팅: ${formatKRW(baseAmt)}\n` +
                `📦 잔액: ${formatKRW(user.points)}\n` +
                `─────────────────────\n` +
                `!콜 (그대로) / !다이 (포기) / !따당 (2배) / !하프 (반) / !삥 (1000원) / !올인 / [금액]\n` +
                (gameSessions[room].cardChangesLeft>0 ? `💡 !패교체 사용 가능 (${gameSessions[room].cardChangesLeft}회 남음)\n` : '')
            );
        }

        // 섯다 배팅 명령어들 (!콜, !다이, !따당, !하프, !삥, !올인, 또는 [금액])
        function handleSutdaBet(betArg) {
            const s = gameSessions[room];
            if (!s || s.player !== sender) return null;

            let addAmt;
            if (betArg === '!콜' || betArg === '콜')       addAmt = 0;
            else if (betArg === '!다이' || betArg === '다이') return { action: 'die' };
            else if (betArg === '!따당' || betArg === '따당') addAmt = s.baseBet; // 기본배팅과 같은 금액 추가
            else if (betArg === '!하프' || betArg === '하프') addAmt = Math.floor(s.baseBet/2);
            else if (betArg === '!삥' || betArg === '삥')     addAmt = 1000;
            else if (betArg === '!올인' || betArg === '올인') addAmt = user.points;
            else {
                const parsed = parseAmount(betArg);
                if (isNaN(parsed) || parsed < 0) return null;
                addAmt = parsed;
            }

            if (addAmt > user.points) return { error: `❌ 잔액 부족 (보유: ${formatKRW(user.points)})` };
            return { action: 'bet', add: addAmt };
        }

        if (['!콜','!다이','!따당','!하프','!삥','!올인'].includes(cmd) ||
            (gameSessions[room] && gameSessions[room].player === sender && !isNaN(parseAmount(cmd)))) {

            const s = gameSessions[room];
            if (!s || s.player !== sender) return; // 세션 없거나 다른 사람

            const result = handleSutdaBet(cmd);
            if (!result) return reply('❌ 배팅 명령어 오류');
            if (result.error) return reply(result.error);

            // 다이 처리
            if (result.action === 'die') {
                // 다이 시 걸린 판돈의 절반 회수 (실비형)
                const refund = Math.floor(s.totalBet * 0.5);
                user.points += refund;
                user.stats.sutda.losses = (user.stats.sutda.losses||0) + 1;
                saveData(db);
                delete gameSessions[room];
                return reply(`🏳️ [다이]\n걸린 판돈: ${formatKRW(s.totalBet)}\n환급: +${formatKRW(refund)} (50%)\n잔액: ${formatKRW(user.points)}`);
            }

            // 배팅 추가
            const addAmt = result.add;
            user.points -= addAmt;
            s.totalBet += addAmt;

            // 딜러 다이 판정 (2패 배팅단계에서 큰 금액 걸었을 때)
            let dealerDied = false;
            if (s.stage === 2 && !s.dealerSealed) {
                const betRatio = addAmt / Math.max(s.baseBet, 1);
                const dealerDieChance = Math.min(CONFIG.sutda.dealerDieMaxChance/100, betRatio * 0.03);
                if (Math.random() < dealerDieChance) dealerDied = true;
            }
            // 첫 배팅에 올인일 경우도 딜러가 극악확률로 다이
            if (s.stage === 1 && cmd === '!올인' && !s.dealerSealed) {
                if (Math.random() < 0.02) dealerDied = true;
            }

            if (dealerDied) {
                // 유저가 승리로 처리
                const winAmt = s.totalBet;
                let netWin = winAmt;
                let feeMsg = '';
                if (!s.feeWaived) {
                    const {net, fee} = applyFee(winAmt - s.baseBet, 'sutda'); // 순이익에만 수수료
                    netWin = s.baseBet + net;
                    feeMsg = `\n💸 수수료(${CONFIG.fees.sutda}%): -${formatKRW(fee)}`;
                }
                user.points += netWin * 2; // 상대 배팅도 가져옴 (딜러 대신 상대판돈으로 취급)
                user.stats.sutda.wins = (user.stats.sutda.wins||0) + 1;
                saveData(db);
                delete gameSessions[room];
                return reply(
                    `🎴 [딜러가 다이했습니다!]\n─────────────────────\n` +
                    `🏆 승리! 판돈 몰수\n` +
                    `획득: +${formatKRW(winAmt)}${feeMsg}\n` +
                    `잔액: ${formatKRW(user.points)}`
                );
            }

            // stage 1 → 2 전환
            if (s.stage === 1) {
                s.stage = 2;
                saveData(db);
                return reply(
                    `🎴 [두 번째 패 공개]\n─────────────────────\n` +
                    `🃏 내 패: [ ${s.pCards[0].name} ][ ${s.pCards[1].name} ] (${s.pResult.name})\n` +
                    `💰 현재 판돈: ${formatKRW(s.totalBet)}\n` +
                    `─────────────────────\n` +
                    `!콜 / !다이 / !따당 / !하프 / !삥 / !올인 / [금액]\n` +
                    (s.cardChangesLeft>0 ? `💡 !패교체 사용 가능 (${s.cardChangesLeft}회 남음)\n` : '')
                );
            }

            // stage 2 콜/배팅 → 결과 판정
            const pRes = s.pResult, dRes = s.dResult;
            let msg = `🎴 [섯다 결과]\n─────────────────────\n` +
                      `👤 내 패: [ ${s.pCards[0].name} ][ ${s.pCards[1].name} ] (${pRes.name})\n` +
                      `🤖 딜러: [ ${s.dCards[0].name} ][ ${s.dCards[1].name} ] (${dRes.name})\n` +
                      `💰 판돈: ${formatKRW(s.totalBet)}\n─────────────────────\n`;

            if (pRes.score > dRes.score) {
                let winAmt = s.totalBet;
                let feeMsg = '';
                if (!s.feeWaived) {
                    const {net, fee} = applyFee(winAmt - s.baseBet, 'sutda');
                    winAmt = s.baseBet + net;
                    feeMsg = `\n💸 수수료(${CONFIG.fees.sutda}%): -${formatKRW(fee)}`;
                }
                user.points += winAmt * 2;
                user.stats.sutda.wins = (user.stats.sutda.wins||0) + 1;
                msg += `🏆 승리! +${formatKRW(winAmt)}${feeMsg}`;
            } else if (pRes.score < dRes.score) {
                user.stats.sutda.losses = (user.stats.sutda.losses||0) + 1;
                msg += `💸 패배 -${formatKRW(s.totalBet)}`;
            } else {
                user.points += s.totalBet; // 무승부 환불
                user.stats.sutda.draws = (user.stats.sutda.draws||0) + 1;
                msg += `🤝 무승부. 판돈 환불`;
            }

            saveData(db);
            delete gameSessions[room];
            return reply(`${msg}\n잔액: ${formatKRW(user.points)}`);
        }

        // 섯다 패 교체 (아이템 필요)
        if (cmd === '!패교체') {
            const s = gameSessions[room];
            if (!s || s.player !== sender) return;
            if (s.cardChangesLeft <= 0) return reply('❌ 패교체권이 없습니다. (랜덤상자에서 획득)');
            const shuffled = [...DECK].sort(()=>Math.random()-0.5);
            s.pCards[0] = shuffled[0];
            s.pResult = evaluateHand(s.pCards[0], s.pCards[1]);
            s.cardChangesLeft--;
            // 실제 아이템도 하나 소모
            consumeItem(user, 'card_change');
            saveData(db);
            return reply(`🔄 [패교체] 새 패: [ ${s.pCards[0].name} ]\n남은 교체권: ${s.cardChangesLeft}회`);
        }

        // ══════════════════════════════════════════════
        // 블랙잭
        // ══════════════════════════════════════════════
        if (cmd === '!블랙잭') {
            if (blackjackSessions[room]) return reply('⚠️ 이미 진행 중');
            if (args.length<1) return reply(`❌ !블랙잭 [금액] (보유: ${formatKRW(user.points)})`);
            const bet = resolveBetAmount(args[0], user.points);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);

            const pHand = [drawCard(), drawCard()];
            const dHand = [drawCard(), drawCard()];

            // 신의 손 효과: 블랙잭 확률 상승
            const divine = sumItemEffect(user, 'bj_divine');
            if (divine>0 && Math.random()<divine/100 && !isBJ(pHand)) {
                pHand[0] = { rank:'A', suit:'♠' };
                pHand[1] = { rank:'K', suit:'♥' };
            }

            user.points -= bet;
            saveData(db);
            blackjackSessions[room] = {
                player: sender,
                bet,
                hands: [{cards: pHand, doubled: false, done: false}],
                activeIdx: 0,
                dealerHand: dHand,
                canFirst: true,
                feeWaived: consumeItem(user,'omniscient') || consumeItem(user,'fee_waive'),
                insurance: hasItem(user,'bj_insurance')
            };

            const canSplit = pHand[0].rank === pHand[1].rank;
            const peek = consumeItem(user, 'bj_peek');

            let m = `🃏 [블랙잭] 배팅 ${formatKRW(bet)}\n` +
                    `👤 내 패: ${handStr(pHand)} (${calcBJ(pHand)})\n`;
            if (peek) m += `🔍 딜러 숨긴 패: ${cardStr(dHand[1])} (투시경 효과!)\n`;
            else m += `🤖 딜러: ${cardStr(dHand[0])} 🂠\n`;

            if (isBJ(pHand)) {
                const j = judgeBJ(pHand, dHand, bet, false);
                user.points += bet + j.payout;
                if (j.type==='BLACKJACK'||j.type==='WIN') user.stats.blackjack.wins=(user.stats.blackjack.wins||0)+1;
                saveData(db);
                delete blackjackSessions[room];
                return reply(m + `\n🤖 딜러: ${handStr(dHand)} (${calcBJ(dHand)})\n${bjLabel(j.type)} ${j.payout>=0?'+':''}${formatKRW(j.payout)}\n잔액: ${formatKRW(user.points)}`);
            }

            m += `\n!히트 / !스탠드`;
            if (bet <= user.points) m += ` / !더블다운`;
            if (canSplit) m += ` / !스플릿`;
            return reply(m);
        }

        if (cmd === '!히트') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            const h = s.hands[s.activeIdx];
            if (!h || h.done) return reply('❌ 종료된 패');
            h.cards.push(drawCard());
            s.canFirst = false;
            const sc = calcBJ(h.cards);
            let m = `🃏 [히트] ${handStr(h.cards)} (${sc})\n`;
            if (sc >= 21) {
                h.done = true;
                m += sc>21 ? '💥 버스트!\n' : '✨ 21!\n';
                return reply(m + advanceBJ(db, room, sender));
            }
            m += '!히트 / !스탠드';
            return reply(m);
        }

        if (cmd === '!스탠드') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            const h = s.hands[s.activeIdx];
            if (!h || h.done) return reply('❌ 종료된 패');
            h.done = true;
            return reply(`🛑 [스탠드] ${handStr(h.cards)} (${calcBJ(h.cards)})\n` + advanceBJ(db, room, sender));
        }

        if (cmd === '!더블다운') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            if (!s.canFirst) return reply('❌ 더블다운은 첫 행동에서만');
            const h = s.hands[s.activeIdx];
            if (user.points < s.bet) return reply(`❌ 자금 부족`);
            user.points -= s.bet;
            h.doubled = true;
            h.cards.push(drawCard());
            h.done = true;
            saveData(db);
            const sc = calcBJ(h.cards);
            return reply(`💰 [더블다운] ${handStr(h.cards)} (${sc})${sc>21?' 💥 버스트':''}\n` + advanceBJ(db, room, sender));
        }

        if (cmd === '!스플릿') {
            const s = blackjackSessions[room];
            if (!s || s.player !== sender) return;
            if (!s.canFirst || s.hands.length>1) return reply('❌ 스플릿 불가');
            const h = s.hands[0];
            if (h.cards[0].rank !== h.cards[1].rank) return reply('❌ 같은 숫자만 스플릿 가능');
            if (user.points < s.bet) return reply(`❌ 자금 부족`);
            user.points -= s.bet;
            saveData(db);
            const c1=h.cards[0], c2=h.cards[1];
            s.hands = [
                {cards:[c1, drawCard()], doubled:false, done:false},
                {cards:[c2, drawCard()], doubled:false, done:false}
            ];
            s.activeIdx = 0;
            s.canFirst = true;
            const h1 = s.hands[0];
            return reply(`✂️ [스플릿]\n[1번째] ${handStr(h1.cards)} (${calcBJ(h1.cards)})\n!히트 / !스탠드 / !더블다운`);
        }

        // ══════════════════════════════════════════════
        // 바카라
        // ══════════════════════════════════════════════
        // 바카라 룰: 플레이어/뱅커/타이 중 하나 배팅, 카드 각각 2장씩 뽑아 합 뒷자리로 비교
        if (cmd === '!바카라') {
            if (args.length<2) return reply(`❌ !바카라 [플레이어/뱅커/타이] [금액]\n예: !바카라 뱅커 1만`);
            const choice = args[0];
            if (!['플레이어','뱅커','타이','p','b','t','P','B','T'].includes(choice))
                return reply('❌ 플레이어/뱅커/타이 중 선택');
            const bet = resolveBetAmount(args[1], user.points);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);

            const normChoice = ['p','P','플레이어'].includes(choice) ? '플레이어'
                             : ['b','B','뱅커'].includes(choice) ? '뱅커' : '타이';

            user.points -= bet;

            const pCards = [drawCard(), drawCard()];
            const bCards = [drawCard(), drawCard()];
            const pScore = (calcBJ(pCards) % 10) || (calcBJ(pCards)===0 ? 0 : calcBJ(pCards)%10);
            const bScore = (calcBJ(bCards) % 10);

            // 결과 판정
            let winner;
            if (pScore > bScore) winner = '플레이어';
            else if (bScore > pScore) winner = '뱅커';
            else winner = '타이';

            const won = winner === normChoice;
            let payout = 0;
            if (won) {
                if (normChoice === '플레이어') payout = bet; // 1:1
                else if (normChoice === '뱅커') payout = Math.floor(bet * 0.95); // 1:0.95 (5% 하우스컷)
                else payout = bet * 8; // 타이 1:8
            } else {
                if (winner === '타이' && normChoice !== '타이') payout = 0; // 타이 나오면 플레이어/뱅커 배팅은 밀림(잃지 않음)
                else payout = -bet;
            }

            // 아이템 효과
            const bacBoost = sumItemEffect(user, 'baccarat_boost');
            if (won && bacBoost>0) payout = Math.floor(payout * (1 + bacBoost/100));

            // 수수료
            const feeWaived = consumeItem(user,'omniscient') || consumeItem(user,'fee_waive');
            let feeMsg = '';
            if (won && payout>0 && !feeWaived) {
                const {net, fee} = applyFee(payout, 'baccarat');
                payout = net;
                feeMsg = `\n💸 수수료(${CONFIG.fees.baccarat}%): -${formatKRW(fee)}`;
            }

            // 타이 밀림 처리
            if (payout === 0 && !won) {
                user.points += bet; // 배팅 원금 환급
            } else {
                user.points += bet + payout; // 배팅+손익
            }

            // 통계
            if (won) user.stats.baccarat.wins = (user.stats.baccarat.wins||0) + 1;
            else if (payout < 0) user.stats.baccarat.losses = (user.stats.baccarat.losses||0) + 1;

            saveData(db);
            return reply(
                `🎴 [바카라 결과]\n─────────────────────\n` +
                `👤 플레이어: ${handStr(pCards)} = ${pScore}\n` +
                `🏛️ 뱅커: ${handStr(bCards)} = ${bScore}\n` +
                `─────────────────────\n` +
                `승자: ${winner}\n` +
                `내 선택: ${normChoice}\n` +
                (won ? `🏆 적중! +${formatKRW(payout)}${feeMsg}` : payout===0 ? `🤝 밀림 (배팅액 환급)` : `💸 실패 -${formatKRW(bet)}`) + `\n` +
                `잔액: ${formatKRW(user.points)}`
            );
        }

        // ══════════════════════════════════════════════
        // 숫자맞추기
        // ══════════════════════════════════════════════
        if (cmd === '!숫자맞추기') {
            if (numberGuessSessions[room]) return reply('⚠️ 이미 진행 중');
            if (args.length<1) return reply('❌ !숫자맞추기 [개수(3~8)]');
            const n = parseInt(args[0], 10);
            if (isNaN(n)||n<3||n>8) return reply('❌ 개수는 3~8');
            const mult = Math.round(n * 0.83 * 100) / 100;
            numberGuessSessions[room] = { range: n, multiplier: mult, host: sender };
            return reply(`🔢 [숫자맞추기 개설]\n범위: 1~${n} / 배율: ${mult}배\n!숫자배팅 [금액] [숫자]`);
        }

        if (cmd === '!숫자배팅') {
            const s = numberGuessSessions[room];
            if (!s) return reply('❌ 진행 중인 게임 없음');
            if (args.length<2) return reply('❌ !숫자배팅 [금액] [숫자]');
            const bet = resolveBetAmount(args[0], user.points);
            const guess = parseInt(args[1], 10);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);
            if (isNaN(guess)||guess<1||guess>s.range) return reply(`❌ 1~${s.range} 사이 숫자`);

            // 오답 제거 힌트 (아이템)
            let hintMsg = '';
            const hintPower = sumItemEffect(user, 'numguess_hint');
            if (hintPower > 0) {
                // 오답 중 hintPower개 미리 알려줌 (정답은 절대 안 나옴)
                const wrong = [];
                for (let i=1; i<=s.range; i++) if (i !== guess) wrong.push(i);
                // 진짜 정답을 미리 뽑아둬서 그건 힌트에 안 넣음
                const answerPreview = Math.floor(Math.random()*s.range)+1;
                const wrongToShow = wrong.filter(w => w !== answerPreview).slice(0, hintPower);
                if (wrongToShow.length > 0) {
                    hintMsg = `\n💡 오답 힌트: [${wrongToShow.join(', ')}] 은 정답이 아닙니다.`;
                }
                // 아이템 하나만 소모
                consumeItem(user, 'numguess_hint');
                // 아까 뽑은 정답을 재사용
                s._presetAnswer = answerPreview;
            }

            const answer = s._presetAnswer || (Math.floor(Math.random()*s.range)+1);
            const won = guess === answer;

            let msg = `🔢 [결과]\n범위 1~${s.range}\n선택: ${guess} / 정답: ${answer}${hintMsg}\n`;

            if (won) {
                let payout = Math.floor(bet * s.multiplier);
                const feeWaived = consumeItem(user,'omniscient') || consumeItem(user,'fee_waive');
                let feeMsg = '';
                if (!feeWaived) {
                    const {net, fee} = applyFee(payout - bet, 'numberGuess');
                    payout = bet + net;
                    feeMsg = `\n💸 수수료(${CONFIG.fees.numberGuess}%): -${formatKRW(fee)}`;
                }
                user.points += payout - bet;
                user.stats.numberGuess.wins = (user.stats.numberGuess.wins||0) + 1;
                msg += `🏆 정답! +${formatKRW(payout)}${feeMsg}`;
            } else {
                user.points -= bet;
                user.stats.numberGuess.losses = (user.stats.numberGuess.losses||0) + 1;
                msg += `💸 오답 -${formatKRW(bet)}`;
            }

            saveData(db);
            delete numberGuessSessions[room];
            return reply(`${msg}\n잔액: ${formatKRW(user.points)}`);
        }

        // ══════════════════════════════════════════════
        // 1:1 주사위 대결
        // ══════════════════════════════════════════════
        if (cmd === '!대결신청') {
            if (args.length<2) return reply('❌ !대결신청 [상대닉네임] [금액]');
            const target = args[0];
            const bet = resolveBetAmount(args[1], user.points);
            if (isNaN(bet)||bet<=0||user.points<bet) return reply(`❌ 배팅 오류 (보유: ${formatKRW(user.points)})`);
            if (target === sender) return reply('❌ 자기 자신에게 대결 신청 불가');
            if (!userExists(db, target)) return reply(`❌ "${target}" 유저 없음`);
            if (duelSessions[room]) return reply('⚠️ 이미 진행 중인 대결이 있습니다.');

            const targetUser = ensureUser(db, target);
            if (targetUser.points < bet) return reply(`❌ 상대방 자금 부족`);

            duelSessions[room] = { challenger: sender, target, bet, createdAt: Date.now() };
            return reply(`🎲 [1:1 대결 신청]\n${sender} → ${target}\n배팅: ${formatKRW(bet)} (양측 동일)\n\n${target}님, !대결수락 또는 !대결거절`);
        }

        if (cmd === '!대결수락') {
            const d = duelSessions[room];
            if (!d) return reply('❌ 대기 중인 대결 없음');
            if (d.target !== sender) return reply('❌ 본인 앞으로 온 대결이 아닙니다');
            const challenger = ensureUser(db, d.challenger);
            if (challenger.points < d.bet || user.points < d.bet)
                return reply(`❌ 양측 중 자금 부족한 사람이 있습니다`);

            challenger.points -= d.bet;
            user.points -= d.bet;

            // 주사위 굴리기 (각 2개씩 합 비교)
            const rollDice = () => Math.floor(Math.random()*6)+1;
            const challengerDice = [rollDice(), rollDice()];
            const targetDice = [rollDice(), rollDice()];

            // 아이템 효과: 주사위 조작기 (유리한 방향으로 재굴림)
            const cBoost = sumItemEffect(challenger, 'dice_boost');
            const tBoost = sumItemEffect(user, 'dice_boost');
            const cSum = challengerDice[0]+challengerDice[1];
            const tSum = targetDice[0]+targetDice[1];

            let finalCSum = cSum, finalTSum = tSum;
            if (cBoost>0 && Math.random()<cBoost/100 && cSum < 10) {
                challengerDice[0] = 6; challengerDice[1] = Math.floor(Math.random()*6)+1;
                finalCSum = challengerDice[0]+challengerDice[1];
            }
            if (tBoost>0 && Math.random()<tBoost/100 && tSum < 10) {
                targetDice[0] = 6; targetDice[1] = Math.floor(Math.random()*6)+1;
                finalTSum = targetDice[0]+targetDice[1];
            }

            let winner, loser;
            if (finalCSum > finalTSum) { winner = d.challenger; loser = d.target; }
            else if (finalTSum > finalCSum) { winner = d.target; loser = d.challenger; }
            else winner = null;

            let msg = `🎲 [1:1 주사위 대결 결과]\n─────────────────────\n` +
                      `${d.challenger}: 🎲 ${challengerDice.join(' + ')} = ${finalCSum}\n` +
                      `${d.target}: 🎲 ${targetDice.join(' + ')} = ${finalTSum}\n` +
                      `─────────────────────\n`;

            if (winner) {
                const winUser = winner === sender ? user : challenger;
                let winAmt = d.bet * 2;
                const {net, fee} = applyFee(winAmt - d.bet, 'duel');
                winAmt = d.bet + net;
                winUser.points += winAmt;
                if (winner === d.challenger) {
                    challenger.stats.duel.wins = (challenger.stats.duel.wins||0)+1;
                    user.stats.duel.losses = (user.stats.duel.losses||0)+1;
                } else {
                    user.stats.duel.wins = (user.stats.duel.wins||0)+1;
                    challenger.stats.duel.losses = (challenger.stats.duel.losses||0)+1;
                }
                msg += `🏆 승자: ${winner}\n획득: +${formatKRW(winAmt)}\n💸 수수료(${CONFIG.fees.duel}%): -${formatKRW(fee)}`;
            } else {
                challenger.points += d.bet;
                user.points += d.bet;
                msg += `🤝 무승부. 배팅액 환급`;
            }

            saveData(db);
            delete duelSessions[room];
            return reply(msg);
        }

        if (cmd === '!대결거절') {
            const d = duelSessions[room];
            if (!d) return reply('❌ 대기 중인 대결 없음');
            if (d.target !== sender) return reply('❌ 본인 대결이 아닙니다');
            delete duelSessions[room];
            return reply(`🚫 ${sender}님이 대결을 거절했습니다.`);
        }

        // ══════════════════════════════════════════════
        // 퀴즈 정답 감지 (일반 채팅에서)
        // ══════════════════════════════════════════════
        if (currentQuiz && content.includes(currentQuiz.a)) {
            if (quizTimer) { clearTimeout(quizTimer); quizTimer = null; }
            currentQuiz = null;
            const reward = rollQuizReward();
            let msg = `🎊 정답! ${sender}님 획득: `;
            if (reward.type === 'cash') {
                user.points += reward.value;
                msg += `현금 ${formatKRW(reward.value)}`;
            } else if (reward.type === 'box') {
                user.boxes[reward.value] = (user.boxes[reward.value]||0) + 1;
                msg += `${reward.value} 1개!`;
            }
            saveData(db);
            return reply(`${msg}\n잔액: ${formatKRW(user.points)}`);
        }

    } catch (e) {
        console.error('엔진 에러:', e);
    }
});

server.bind(PORT);
