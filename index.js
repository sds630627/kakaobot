'use strict';

// index.js — 타짜 카카오봇 UDP 매칭 엔진 (v3: 평단가추적/약어파서/타짜기술수정/풀매수매도 등)
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'users.json');
const MARKET_FILE = path.join(__dirname, 'market.json');

const server = dgram.createSocket('udp4');

// ───────────────────────────────────────────────
// 1. 정적 데이터
// ───────────────────────────────────────────────
const COIN_NAMES = ['성빈코인', '호근코인', '정재코인', '몰탈코인', '펭즈코인', '첨지코인'];
const ADMIN_NAME = 'A';

const ITEM_SHOP = {
    '평경장의손': { price: 1000, type: '무기', desc: '섯다 패 교체 확률 제공 (1단계, !바꾸기 1회)' },
    '짝귀의귀': { price: 3000, type: '액세서리', desc: '상대 패의 족보 등급 미리 예측' },
    '고니의구라': { price: 7000, type: '기술', desc: '섯다 패 교체 확률 제공 (2단계, 평경장의손과 함께 보유 시 !바꾸기 2회). 평경장의손 없이는 구매 불가' },
    '아귀의눈': { price: 15000, type: '눈빛', desc: '5% 확률로 삼팔광땡 설계 가능' },
    '고광렬의입담': { price: 500, type: '타이틀', desc: '단톡방 화려한 말빨 장착' }
};

// 단위: P (포인트). 만=10,000 / 억=100,000,000 / 조=1,000,000,000,000
const MAN = 10000;
const EOK = 100000000;
const JO = 1000000000000;

const DEFAULT_LUXURY = {
    '롤렉스_서브마리너': { basePrice: 1500 * MAN, currentPrice: 1500 * MAN, type: '명품시계' },
    '오데마피게_로열오크': { basePrice: 4500 * MAN, currentPrice: 4500 * MAN, type: '하이퍼시계' },
    '포르쉐_911_GT3RS': { basePrice: Math.round(3.5 * EOK), currentPrice: Math.round(3.5 * EOK), type: '스포츠카' },
    '람보르기니_우루스': { basePrice: Math.round(2.8 * EOK), currentPrice: Math.round(2.8 * EOK), type: '슈퍼SUV' },
    '페라리_SF90': { basePrice: 6 * EOK, currentPrice: 6 * EOK, type: '하이퍼카' },
    '테슬라_모델X': { basePrice: Math.round(1.5 * EOK), currentPrice: Math.round(1.5 * EOK), type: '전기차' },
    '부가티_시론': { basePrice: 40 * EOK, currentPrice: 40 * EOK, type: '하이퍼카' },
    '한강뷰_신축빌라': { basePrice: 100 * EOK, currentPrice: 100 * EOK, type: '빌라' },
    '양평_전원주택': { basePrice: 400 * EOK, currentPrice: 400 * EOK, type: '전원주택' },
    '강남_타워팰리스': { basePrice: 800 * EOK, currentPrice: 800 * EOK, type: '아파트' },
    '개인전용기_걸프스트림': { basePrice: Math.round(0.15 * JO), currentPrice: Math.round(0.15 * JO), type: '전용기' },
    '초호화요트_아주레': { basePrice: Math.round(0.3 * JO), currentPrice: Math.round(0.3 * JO), type: '요트' },
    '샹보르엠무파라드_성': { basePrice: Math.round(1.5 * JO), currentPrice: Math.round(1.5 * JO), type: '성/대저택' },
    '맨해튼_스카이스크래퍼': { basePrice: 3 * JO, currentPrice: 3 * JO, type: '빌딩' },
    '사설섬_프라이빗아일랜드': { basePrice: 5 * JO, currentPrice: 5 * JO, type: '섬' },
    '스페이스X': { basePrice: 10 * JO, currentPrice: 10 * JO, type: '우주기업' },
    '글로벌은행_지분': { basePrice: 25 * JO, currentPrice: 25 * JO, type: '금융기업' },
    '대륙급_광산기업': { basePrice: 50 * JO, currentPrice: 50 * JO, type: '자원기업' },
    '세계최대_반도체기업': { basePrice: 80 * JO, currentPrice: 80 * JO, type: '반도체기업' },
    '달표면_채굴권': { basePrice: 100 * JO, currentPrice: 100 * JO, type: '우주자산' }
};

const DEFAULT_COIN = {
    '성빈코인': { currentPrice: 100, lastPrice: 100, desc: '하이리스크 코인' },
    '호근코인': { currentPrice: 100, lastPrice: 100, desc: '안정 추구형 대장 코인' },
    '정재코인': { currentPrice: 100, lastPrice: 100, desc: '상장폐지 위험 잡코인' },
    '몰탈코인': { currentPrice: 100, lastPrice: 100, desc: '신생 다크호스 코인' },
    '펭즈코인': { currentPrice: 100, lastPrice: 100, desc: '커뮤니티 밈 코인' },
    '첨지코인': { currentPrice: 100, lastPrice: 100, desc: '큰손이 움직이는 코인' }
};

// 직원(알바) 목록 — hirePrice: 영입 가격, perMinute: 분당 수익(P)
const EMPLOYEE_SHOP = {
    '박장호': { hirePrice: 500 * MAN, perMinute: 5000, desc: '평범한 알바생' },
    '박성빈': { hirePrice: 3000 * MAN, perMinute: 30000, desc: '성실한 직원' },
    '몰탈': { hirePrice: 8000 * MAN, perMinute: 80000, desc: '눈빛이 매서운 신입' },
    '임정재': { hirePrice: Math.round(1.2 * EOK), perMinute: 120000, desc: '능력있는 매니저' },
    '조호근': { hirePrice: 5 * EOK, perMinute: 500000, desc: '베테랑 임원' },
    '펭즈': { hirePrice: 50 * EOK, perMinute: 5000000, desc: '의문의 거상' },
    '워렌버핏': { hirePrice: 1 * JO, perMinute: 10000000, desc: '투자의 귀재' },
    '첨지': { hirePrice: Math.round(2.5 * JO), perMinute: 25000000, desc: '소문 속의 큰손' },
    '일론머스크': { hirePrice: 5 * JO, perMinute: 10000000, desc: '괴짜 천재 사업가 (1분당 1000만P)' }
};

const DECK = [
    { m: 1, name: '1광' }, { m: 1, name: '1피' }, { m: 2, name: '2열' }, { m: 2, name: '2피' },
    { m: 3, name: '3광' }, { m: 3, name: '3피' }, { m: 4, name: '4열' }, { m: 4, name: '4피' },
    { m: 5, name: '5열' }, { m: 5, name: '5피' }, { m: 6, name: '6열' }, { m: 6, name: '6피' },
    { m: 7, name: '7열' }, { m: 7, name: '7피' }, { m: 8, name: '8광' }, { m: 8, name: '8열' },
    { m: 9, name: '9열' }, { m: 9, name: '9피' }, { m: 10, name: '10열' }, { m: 10, name: '10피' }
];

const HORSES = [
    { no: 1, name: '아귀호' },
    { no: 2, name: '곤이호' },
    { no: 3, name: '평경장호' },
    { no: 4, name: '고광렬호' },
    { no: 5, name: '정마담호' }
];

const NEWS_POOL = {
    '성빈코인': {
        up: ['📰 [속보] 일론 머스크, \'성빈코인\' 화성 이주지 핵심 화폐 지정!', '📰 [호재] 성빈코인 재단, 해외 상장 확정 소식에 매수 대폭발'],
        down: ['📰 [경보] 개발자 지갑에서 대량의 물량이 거래소로 이동 포착!', '📰 [속보] 정부, 불법 사행성 혐의 조사 착수 소식에 패닉']
    },
    '호근코인': {
        up: ['📰 [호재] 대기업 자산운용사, \'호근코인\' 기반 ETF 승인 완료', '📰 [뉴스] 호근코인 고래들, 물량 영구 락업 계약 체결 완료'],
        down: ['📰 [뉴스] 블록체인 트전송망 오류 발생으로 마비 악재', '📰 [경보] 대주주 세금 체납 건으로 지분 강제 청산 공시']
    },
    '정재코인': {
        up: ['📰 [찌라시] 워렌 버핏이 새벽에 정재코인을 대량 매집한 정황 포착!', '📰 [속보] 글로벌 하이퍼카 결제 시스템 도입 계약 완료'],
        down: ['📰 [🚨상폐] 상장 폐지 실질심사 대상 지정 소식에 역대급 폭락!', '📰 [악재] 정재코인 공식 커뮤니티 해킹 발생 신뢰도 추락']
    },
    '몰탈코인': {
        up: ['📰 [속보] \'몰탈코인\' 정체불명 고래, 단일 거래로 물량 절반 매집!', '📰 [호재] 몰탈코인 개발팀, 글로벌 거래소 동시 상장 발표'],
        down: ['📰 [경보] 몰탈코인 공식 텔레그램 갑자기 폐쇄, 먹튀 의혹 확산', '📰 [속보] 몰탈코인 핵심 개발자 잠적, 커뮤니티 패닉']
    },
    '펭즈코인': {
        up: ['📰 [화제] \'펭즈코인\', 유명 인플루언서 언급 한 줄에 거래량 폭증', '📰 [호재] 펭즈코인 밈 챌린지 전세계 확산, 신규 지갑 급증'],
        down: ['📰 [뉴스] 펭즈코인 밈 유행 시들, 거래량 급감 우려', '📰 [경보] 펭즈코인 커뮤니티 내부 분열로 신뢰도 하락']
    },
    '첨지코인': {
        up: ['📰 [찌라시] \'첨지코인\' 뒤에 큰손이 있다는 소문에 매수세 집중', '📰 [속보] 첨지코인, 은밀한 기관 자금 유입 정황 포착'],
        down: ['📰 [경보] 첨지코인 큰손 물량 일부 이탈, 시장 동요', '📰 [악재] 첨지코인 관련 규제 검토 소식에 매도 압력']
    }
};

const QUIZZES = [
    { q: '세상에서 가장 가난한 왕은?', a: '최저임금' },
    { q: '차가 울면 무엇일까요?', a: '카잉' },
    { q: '오리가 얼면 무엇이 될까요?', a: '언덕' },
    { q: '영화 타짜에서 아귀가 밑장빼기 하려다 걸린 화투 패는?', a: '단풍' },
    { q: '조선시대 백성들을 위해 훈민정음을 창제하신 임금은?', a: '세종대왕' }
];

// ───────────────────────────────────────────────
// 2. 런타임 상태
// ───────────────────────────────────────────────
let LUXURY_MARKET = {};
let COIN_MARKET = {};
const gameSessions = {};
let horseRace = null;
let numberGuessSessions = {};
const blackjackSessions = {};
let currentQuiz = null;
let quizTimer = null;
let activeQuizRooms = [];
let activeNewsRooms = [];

// ───────────────────────────────────────────────
// 3. 저장 / 로드 (모두 예외 처리)
// ───────────────────────────────────────────────
function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        console.error('users.json 로드 실패 (빈 데이터로 시작):', e.message);
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
            LUXURY_MARKET = (data && data.luxury) ? data.luxury : {};
            COIN_MARKET = (data && data.coin) ? data.coin : {};
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
        console.error('market.json 로드 실패 (기본값으로 초기화):', e.message);
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

// ───────────────────────────────────────────────
// 4. 유저 레코드 정규화
//    luxuries/coins: { count, avgPrice } 형태로 평단가 추적
//    (기존 숫자 형식 데이터는 자동으로 새 형식으로 마이그레이션)
// ───────────────────────────────────────────────
function createDefaultUser() {
    return {
        points: 2000,
        lastCheckIn: '',
        items: [],
        luxuries: {},   // { "이름": { count: N, avgPrice: N } }
        coins: {},      // { "이름": { count: N, avgPrice: N } }
        employees: {}
    };
}

function normalizeHolding(raw) {
    // 옛 형식(숫자) -> 새 형식({count, avgPrice}) 마이그레이션
    if (typeof raw === 'number') {
        return raw > 0 ? { count: raw, avgPrice: 0 } : { count: 0, avgPrice: 0 };
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const count = typeof raw.count === 'number' && !Number.isNaN(raw.count) ? raw.count : 0;
        const avgPrice = typeof raw.avgPrice === 'number' && !Number.isNaN(raw.avgPrice) ? raw.avgPrice : 0;
        return { count, avgPrice };
    }
    return { count: 0, avgPrice: 0 };
}

function ensureUser(db, name) {
    let u = Object.prototype.hasOwnProperty.call(db, name) ? db[name] : null;

    if (!u || typeof u !== 'object' || Array.isArray(u)) {
        u = createDefaultUser();
    }
    if (typeof u.points !== 'number' || Number.isNaN(u.points)) u.points = 2000;
    if (typeof u.lastCheckIn !== 'string') u.lastCheckIn = '';
    if (!Array.isArray(u.items)) u.items = [];
    if (!u.luxuries || typeof u.luxuries !== 'object' || Array.isArray(u.luxuries)) u.luxuries = {};
    if (!u.coins || typeof u.coins !== 'object' || Array.isArray(u.coins)) u.coins = {};
    if (!u.employees || typeof u.employees !== 'object' || Array.isArray(u.employees)) u.employees = {};

    // luxuries 마이그레이션
    for (const key of Object.keys(u.luxuries)) {
        u.luxuries[key] = normalizeHolding(u.luxuries[key]);
    }
    // coins 마이그레이션 (모든 코인 종류 보장)
    for (const c of COIN_NAMES) {
        u.coins[c] = normalizeHolding(u.coins[c]);
    }

    db[name] = u;
    return u;
}

function userExists(db, name) {
    return Object.prototype.hasOwnProperty.call(db, name)
        && db[name]
        && typeof db[name] === 'object'
        && !Array.isArray(db[name]);
}

// 매수/구매 시 가중평균 평단가 갱신
function updateAvgBuy(holding, buyQty, buyPrice) {
    const oldCount = holding.count || 0;
    const oldAvg = holding.avgPrice || 0;
    const newCount = oldCount + buyQty;
    const newAvg = newCount > 0 ? Math.round((oldAvg * oldCount + buyPrice * buyQty) / newCount) : 0;
    holding.count = newCount;
    holding.avgPrice = newAvg;
}

// ───────────────────────────────────────────────
// 5. 금액/약어 파서 (요청 4, 5, 6, 7)
//    "100만", "1.5억", "1.5조", "올인", "하프", "삥", "다이", "풀" 등 지원
// ───────────────────────────────────────────────

// 일반 금액 문자열 파싱: "100만" -> 1000000, "1.5억" -> 150000000, "5000" -> 5000
function parseAmount(str) {
    if (str == null) return NaN;
    str = String(str).trim();
    if (str === '') return NaN;

    const match = str.match(/^(\d+(?:\.\d+)?)(만|억|조)?$/);
    if (!match) {
        const plain = parseInt(str, 10);
        return Number.isNaN(plain) ? NaN : plain;
    }

    const num = parseFloat(match[1]);
    const unit = match[2];
    let multiplier = 1;
    if (unit === '만') multiplier = MAN;
    else if (unit === '억') multiplier = EOK;
    else if (unit === '조') multiplier = JO;

    return Math.round(num * multiplier);
}

// 배팅 약어: 올인(전액), 하프(절반), 삥(1000P 고정 최소배팅), 다이(배팅 취소를 뜻하므로 별도 처리)
// betAmountArg: 사용자가 입력한 문자열, currentPoints: 현재 보유 포인트
function resolveBetAmount(betArg, currentPoints) {
    if (betArg === '올인') return currentPoints;
    if (betArg === '하프') return Math.floor(currentPoints / 2);
    if (betArg === '삥') return 1000;
    return parseAmount(betArg);
}

// 송금 약어: 전재산

function formatKRW(n) {
    if (n == null || Number.isNaN(n)) return '0원';
    const neg = n < 0;
    n = Math.abs(Math.floor(n));
    if (n === 0) return '0원';

    // 단위: 해(垓)=10^20, 경(京)=10^16, 조=10^12, 억=10^8, 만=10^4
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
    if (나머지 > 0) {
        const 천 = Math.floor(나머지 / 1000);
        const 미만 = 나머지 % 1000;
        if (천 > 0) parts.push(`${천}천`);
        if (미만 > 0) parts.push(`${미만}원`);
    }

    const result = parts.join(' ');
    return neg ? '-' + result : result;
}

function resolveTransferAmount(amountArg, currentPoints) {
    if (amountArg === '전재산') return currentPoints;
    return parseAmount(amountArg);
}

// 코인/명품 수량 약어: 풀(보유 전량 매도 / 살 수 있는 최대 수량 매수)
function isFullKeyword(arg) {
    return arg === '풀';
}

// ───────────────────────────────────────────────
// 6. 섯다 족보 판정
// ───────────────────────────────────────────────
function evaluateHand(p1, p2) {
    const m1 = p1.m, m2 = p2.m;
    const n1 = p1.name, n2 = p2.name;

    if ((n1 === '3광' && n2 === '8광') || (n1 === '8광' && n2 === '3광')) return { score: 3000, name: '38광땡' };
    if ((n1 === '1광' && n2 === '3광') || (n1 === '3광' && n2 === '1광')) return { score: 2900, name: '13광땡' };
    if ((n1 === '1광' && n2 === '8광') || (n1 === '8광' && n2 === '1광')) return { score: 2800, name: '18광땡' };
    if (m1 === m2) return { score: 2000 + m1 * 10, name: `${m1}땡` };

    const sorted = [m1, m2].sort((a, b) => a - b);
    if (sorted[0] === 1 && sorted[1] === 2) return { score: 1900, name: '알리' };
    if (sorted[0] === 1 && sorted[1] === 4) return { score: 1800, name: '독사' };
    if (sorted[0] === 1 && sorted[1] === 9) return { score: 1700, name: '구삥' };
    if (sorted[0] === 1 && sorted[1] === 10) return { score: 1600, name: '장삥' };
    if (sorted[0] === 4 && sorted[1] === 10) return { score: 1500, name: '장사' };
    if (sorted[0] === 4 && sorted[1] === 6) return { score: 1400, name: '세륙' };

    const kkut = (m1 + m2) % 10;
    if (kkut === 9) return { score: 1009, name: '갑오(9끗)' };
    if (kkut === 0) return { score: 1000, name: '망통(0끗)' };
    return { score: 1000 + kkut, name: `${kkut}끗` };
}

// 타짜기술(패 교체) 최대 사용 가능 횟수 계산 (요청 3)
// 평경장의손만 있으면 1회, 평경장의손+고니의구라 둘 다 있으면 2회
function getMaxCardChanges(user) {
    const hasPyeong = user.items.includes('평경장의손');
    const hasGoni = user.items.includes('고니의구라');
    if (hasPyeong && hasGoni) return 2;
    if (hasPyeong) return 1;
    return 0;
}

// ───────────────────────────────────────────────
// 7. 블랙잭 로직
// ───────────────────────────────────────────────
const BLACKJACK_SUITS = ['♠', '♥', '♦', '♣'];
const BLACKJACK_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function drawBlackjackCard() {
    const suit = BLACKJACK_SUITS[Math.floor(Math.random() * 4)];
    const rank = BLACKJACK_RANKS[Math.floor(Math.random() * 13)];
    return { rank, suit };
}

function cardDisplay(card) {
    return `${card.rank}${card.suit}`;
}

function handDisplay(hand) {
    return hand.map(cardDisplay).join(' ');
}

function calcHandValue(hand) {
    let total = 0;
    let aceCount = 0;
    for (const card of hand) {
        if (card.rank === 'A') {
            total += 11;
            aceCount++;
        } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
            total += 10;
        } else {
            total += parseInt(card.rank, 10);
        }
    }
    while (total > 21 && aceCount > 0) {
        total -= 10;
        aceCount--;
    }
    return total;
}

function isBlackjack(hand) {
    return hand.length === 2 && calcHandValue(hand) === 21;
}

function dealerPlay(dealerHand) {
    while (calcHandValue(dealerHand) < 17) {
        dealerHand.push(drawBlackjackCard());
    }
    return dealerHand;
}

function judgeOneHand(playerHand, dealerHand, betAmount, isSplitHand) {
    const pScore = calcHandValue(playerHand);
    const dScore = calcHandValue(dealerHand);
    const playerBJ = !isSplitHand && isBlackjack(playerHand);
    const dealerBJ = isBlackjack(dealerHand);

    let resultType, payout;

    if (pScore > 21) {
        resultType = 'BUST';
        payout = -betAmount;
    } else if (playerBJ && !dealerBJ) {
        resultType = 'BLACKJACK';
        payout = Math.floor(betAmount * 1.5);
    } else if (playerBJ && dealerBJ) {
        resultType = 'PUSH';
        payout = 0;
    } else if (dScore > 21) {
        resultType = 'WIN';
        payout = betAmount;
    } else if (pScore > dScore) {
        resultType = 'WIN';
        payout = betAmount;
    } else if (pScore < dScore) {
        resultType = 'LOSE';
        payout = -betAmount;
    } else {
        resultType = 'PUSH';
        payout = 0;
    }

    return { resultType, payout, pScore, dScore };
}

function resultLabel(resultType) {
    switch (resultType) {
        case 'BLACKJACK': return '🃏 블랙잭!';
        case 'WIN': return '🏆 승리!';
        case 'LOSE': return '💸 패배';
        case 'PUSH': return '🤝 푸시(무승부)';
        case 'BUST': return '💥 버스트(21 초과)';
        default: return resultType;
    }
}

function advanceBlackjack(db, room, sender) {
    const session = blackjackSessions[room];
    if (!session) return '';

    const nextIdx = session.hands.findIndex((h, idx) => idx > session.activeHandIdx && !h.done);
    if (nextIdx !== -1) {
        session.activeHandIdx = nextIdx;
        session.canFirstAction = true;
        const nextHand = session.hands[nextIdx];
        return `\n➡️ [${nextIdx + 1}번째 패로 이동]\n🃏 ${handDisplay(nextHand.cards)} (${calcHandValue(nextHand.cards)})\n💵 !히트 / !스탠드 / !더블다운 으로 진행하세요.`;
    }

    const user = ensureUser(db, sender);
    const allBust = session.hands.every(h => calcHandValue(h.cards) > 21);

    let dealerHand = session.dealerHand;
    if (!allBust) {
        dealerHand = dealerPlay(dealerHand);
    }
    const dScore = calcHandValue(dealerHand);

    let resultMsg = `\n\n🤖 딜러 패 공개: ${handDisplay(dealerHand)} (${dScore})\n──────────────────\n`;
    let totalPayout = 0;

    session.hands.forEach((hand, idx) => {
        const betForThisHand = hand.doubled ? session.bet * 2 : session.bet;
        const judged = judgeOneHand(hand.cards, dealerHand, betForThisHand, session.hands.length > 1);
        totalPayout += betForThisHand + judged.payout;

        const prefix = session.hands.length > 1 ? `[${idx + 1}번째 패] ` : '';
        resultMsg += `${prefix}${handDisplay(hand.cards)} (${judged.pScore}) → ${resultLabel(judged.resultType)} ${judged.payout >= 0 ? '+' : ''}${formatKRW(judged.payout)}\n`;
    });

    user.points += totalPayout;
    saveData(db);
    delete blackjackSessions[room];

    resultMsg += `──────────────────\n💰 내 지갑: ${formatKRW(user.points)}`;
    return resultMsg;
}

// ───────────────────────────────────────────────
// 8. 숫자맞추기
// ───────────────────────────────────────────────
function getNumberGuessMultiplier(n) {
    return Math.round(n * 0.83 * 100) / 100;
}

// ───────────────────────────────────────────────
// 9. 총자산 계산 (luxuries/coins 새 형식 반영)
// ───────────────────────────────────────────────
function calcEmployeeEarning(emp, hiredAt, now) {
    const minutesElapsed = Math.max(0, (now - hiredAt) / 60000);
    return Math.floor(minutesElapsed * emp.perMinute);
}

function calcNetWorth(user) {
    let luxuryValue = 0;
    for (const [name, holding] of Object.entries(user.luxuries || {})) {
        const count = holding && holding.count ? holding.count : 0;
        if (count > 0 && LUXURY_MARKET[name]) {
            luxuryValue += LUXURY_MARKET[name].currentPrice * count;
        }
    }
    let coinValue = 0;
    for (const [name, holding] of Object.entries(user.coins || {})) {
        const count = holding && holding.count ? holding.count : 0;
        if (count > 0 && COIN_MARKET[name]) {
            coinValue += COIN_MARKET[name].currentPrice * count;
        }
    }
    let employeeEarning = 0;
    const now = Date.now();
    for (const [name, info] of Object.entries(user.employees || {})) {
        const emp = EMPLOYEE_SHOP[name];
        if (emp && info && typeof info.hiredAt === 'number') {
            employeeEarning += calcEmployeeEarning(emp, info.hiredAt, now);
        }
    }
    return {
        cash: user.points,
        luxuryValue,
        coinValue,
        employeeEarning,
        total: user.points + luxuryValue + coinValue + employeeEarning
    };
}

// ───────────────────────────────────────────────
// 10. 경마 로직
// ───────────────────────────────────────────────
function runHorseRace() {
    const TRACK = 24;
    const dist = HORSES.map(() => 0);
    let ticks = 0, finished = false;
    while (!finished && ticks < 300) {
        ticks++;
        for (let i = 0; i < HORSES.length; i++) {
            dist[i] += Math.floor(Math.random() * 4);
            if (dist[i] >= TRACK) finished = true;
        }
    }
    const ranked = HORSES
        .map((h, i) => ({ horse: h, d: dist[i], tie: Math.random() }))
        .sort((a, b) => (b.d - a.d) || (b.tie - a.tie));
    return { ranked, TRACK };
}

function buildRaceBoard(result) {
    const { ranked, TRACK } = result;
    const BAR = 18;
    let board = '🏁 [출발 신호! 두구두구...]\n\n';
    ranked.forEach((row, idx) => {
        const filled = Math.min(BAR, Math.round((Math.min(row.d, TRACK) / TRACK) * BAR));
        const bar = '━'.repeat(filled) + '🏇';
        board += `${row.horse.no}번 ${row.horse.name} (${idx + 1}위)\n|${bar}\n`;
    });
    board += `\n🏆 우승마: [ ${ranked[0].horse.no}번 ${ranked[0].horse.name} ] 🏆`;
    return board;
}

// ───────────────────────────────────────────────
// 11. 무작위 기습 이벤트
// ───────────────────────────────────────────────
function buildNewsReport() {
    const targetCoin = COIN_NAMES[Math.floor(Math.random() * COIN_NAMES.length)];
    const isUpNext = Math.random() > 0.5;
    const pool = isUpNext ? NEWS_POOL[targetCoin].up : NEWS_POOL[targetCoin].down;
    const news = pool[Math.floor(Math.random() * pool.length)];

    for (const key in LUXURY_MARKET) {
        const change = (Math.random() * 0.40) - 0.20;
        let nPrice = Math.floor(LUXURY_MARKET[key].currentPrice * (1 + change));
        const floor = Math.floor(LUXURY_MARKET[key].basePrice * 0.4);
        const cap = Math.floor(LUXURY_MARKET[key].basePrice * 2.5);
        if (nPrice < floor) nPrice = floor;
        if (nPrice > cap) nPrice = cap;
        LUXURY_MARKET[key].currentPrice = nPrice;
    }

    let report = `\n\n─────────────────────\n📰 [실시간 월스트리트 기습 뉴스 공시]\n${news}\n\n📊 [변동 후 코인 시세 정산 명세서]`;
    for (const key in COIN_MARKET) {
        COIN_MARKET[key].lastPrice = COIN_MARKET[key].currentPrice;
        let move = (Math.random() * 0.8) - 0.40;
        if (key === targetCoin) move = isUpNext ? (Math.random() * 0.6) + 0.1 : (Math.random() * 0.5) - 0.45;
        let nCoinPrice = Math.floor(COIN_MARKET[key].currentPrice * (1 + move));
        if (nCoinPrice < 10) nCoinPrice = 10;
        COIN_MARKET[key].currentPrice = nCoinPrice;
        const diff = COIN_MARKET[key].currentPrice - COIN_MARKET[key].lastPrice;
        report += `\n 🪙 ${key}: ${formatKRW(COIN_MARKET[key].currentPrice)} (${diff >= 0 ? '🔺 +' : '🔻 '}${formatKRW(Math.abs(diff))}P)`;
    }

    saveMarket();
    return report;
}

function buildQuiz() {
    currentQuiz = QUIZZES[Math.floor(Math.random() * QUIZZES.length)];
    if (quizTimer) clearTimeout(quizTimer);
    quizTimer = setTimeout(() => { currentQuiz = null; quizTimer = null; }, 60000);
    return `\n\n─────────────────────\n🚨 [돌발 기습 깜짝 퀴즈 선언!]\n🎁 상금: 1,000P\n❓ 문제: ${currentQuiz.q}\n\n※ 정답 단어를 외쳐주세요! (제한시간 1분)`;
}

// ───────────────────────────────────────────────
// 12. 번호 ↔ 이름 매핑 헬퍼
// ───────────────────────────────────────────────
function getLuxuryList() {
    return Object.entries(LUXURY_MARKET);
}

function resolveLuxuryName(arg) {
    const list = getLuxuryList();
    if (/^\d+$/.test(arg)) {
        const idx = parseInt(arg, 10) - 1;
        if (idx >= 0 && idx < list.length) return list[idx][0];
        return null;
    }
    return LUXURY_MARKET[arg] ? arg : null;
}

function getEmployeeShopList() {
    return Object.entries(EMPLOYEE_SHOP);
}

function resolveEmployeeName(arg) {
    const list = getEmployeeShopList();
    if (/^\d+$/.test(arg)) {
        const idx = parseInt(arg, 10) - 1;
        if (idx >= 0 && idx < list.length) return list[idx][0];
        return null;
    }
    return EMPLOYEE_SHOP[arg] ? arg : null;
}

function resolveOwnedEmployeeName(user, arg) {
    const ownedNames = Object.keys(user.employees || {});
    if (/^\d+$/.test(arg)) {
        const idx = parseInt(arg, 10) - 1;
        if (idx >= 0 && idx < ownedNames.length) return ownedNames[idx];
        return null;
    }
    return ownedNames.includes(arg) ? arg : null;
}

function resolveItemShopName(arg) {
    const list = Object.entries(ITEM_SHOP);
    if (/^\d+$/.test(arg)) {
        const idx = parseInt(arg, 10) - 1;
        if (idx >= 0 && idx < list.length) return list[idx][0];
        return null;
    }
    return ITEM_SHOP[arg] ? arg : null;
}

// 시세 변동률 표시 헬퍼 (구매가 대비 ±%)
function formatChangeRate(avgPrice, currentPrice) {
    if (!avgPrice || avgPrice <= 0) return '';
    const rate = ((currentPrice - avgPrice) / avgPrice) * 100;
    const sign = rate >= 0 ? '🔺+' : '🔻';
    return ` (${sign}${Math.abs(rate).toFixed(1)}%)`;
}

// ───────────────────────────────────────────────
// 13. 서버
// ───────────────────────────────────────────────
server.on('listening', () => {
    loadMarket();
    console.log('\n🎴 타짜 무적 매칭 엔진 가동 완료! (3000포트)\n');
});

server.on('error', (err) => {
    console.error('소켓 에러:', err.message);
});

server.on('message', (msg, rinfo) => {
    let data;
    try {
        data = JSON.parse(msg.toString('utf-8'));
    } catch (e) {
        return;
    }
    if (!data || typeof data !== 'object') return;

    const room = data.room;
    const sender = data.sender;
    const content = (data.msg == null ? '' : String(data.msg)).trim();

    if (!sender || !content || room == null) return;

    try {
        const db = loadData();
        const user = ensureUser(db, sender);

        const reply = (text) => {
            let out = String(text);
            if (activeNewsRooms.includes(room) && Math.random() < 0.15) out += buildNewsReport();
            if (activeQuizRooms.includes(room) && !currentQuiz && Math.random() < 0.10) out += buildQuiz();
            const buf = Buffer.from(out, 'utf-8');
            server.send(buf, 0, buf.length, rinfo.port, rinfo.address);
        };

        const parts = content.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);

        // ── 기습 이벤트 ON/OFF ─────────────────────
        if (command === '!퀴즈켜기') {
            if (!activeQuizRooms.includes(room)) activeQuizRooms.push(room);
            return reply('🚨 [기습 퀴즈 활성화 완료]');
        }
        if (command === '!퀴즈끄기') {
            activeQuizRooms = activeQuizRooms.filter(r => r !== room);
            return reply('🎴 [기습 퀴즈 비활성화 완료]');
        }
        if (command === '!뉴스켜기') {
            if (!activeNewsRooms.includes(room)) activeNewsRooms.push(room);
            return reply('📰 [경제 뉴스 활성화 완료]');
        }
        if (command === '!뉴스끄기') {
            activeNewsRooms = activeNewsRooms.filter(r => r !== room);
            return reply('🎴 [경제 뉴스 비활성화 완료]');
        }

        // ── 도움말 (요청 9: 가독성 개선) ───────────
        if (command === '!도움말') {
            return reply(
                '📜 [타짜봇 종합 가이드]\n' +
                '━━━━━━━━━━━━━━━━━━━━\n\n' +
                '🎰 [섯다]\n' +
                ' !섯다 — 게임 시작\n' +
                ' !바꾸기 — 패 교체 (보유 기술에 따라 1~2회)\n' +
                ' !배팅 [금액] — 배팅 (올인/하프/삥 가능)\n\n' +
                '🃏 [블랙잭]\n' +
                ' !블랙잭 [금액] — 시작 (올인/하프 가능)\n' +
                ' !히트 / !스탠드 / !더블다운 / !스플릿\n\n' +
                '🔢 [숫자맞추기]\n' +
                ' !숫자맞추기 [개수 3~8] — 개설\n' +
                ' !숫자배팅 [금액] [숫자] — 배팅+선택 (올인/하프/삥 가능)\n\n' +
                '🐎 [경마]\n' +
                ' !경마시작 / !경마베팅 [말번호] [금액]\n' +
                ' !경마현황 / !경마출발 / !경마취소\n\n' +
                '🛒 [상점]\n' +
                ' !상점 — 장비/명품/차량/자산 목록(번호 표시)\n' +
                ' !구매 [번호] / !판매 [번호]\n' +
                ' !모두팔기 — 보유 사치품 일괄 매각\n\n' +
                '📈 [거래소]\n' +
                ' !시세 — 명품·코인 시세 확인\n' +
                ' !매수 [코인명] [수량 or 풀] — 풀 입력시 보유 현금으로 최대 매수\n' +
                ' !매도 [코인명] [수량 or 풀] — 풀 입력시 전량 매도\n' +
                ' !송금 [닉네임] [금액 or 전재산]\n\n' +
                '👔 [직원 채용]\n' +
                ' !알바상점 / !알바영입 [번호]\n' +
                ' !알바 — 현황 확인 / !알바출금 — 수익 정산\n' +
                ' !알바판매 [번호] — 해고(퇴직금 90%)\n\n' +
                '📊 [자산]\n' +
                ' !지갑 — 총자산+구매가 대비 변동률 확인\n' +
                ' !랭킹 — 자산 순위 TOP 10\n\n' +
                '💡 [금액 입력 팁]\n' +
                ' 숫자, "100만", "1.5억", "1.5조" 모두 가능\n' +
                ' 배팅: "올인"(전액) "하프"(절반) "삥"(1000P)\n' +
                ' 송금: "전재산"\n' +
                ' 코인 매수/매도: "풀"(최대/전량)\n\n' +
                '🔔 [기타]\n' +
                ' !출석 / !퀴즈켜기 / !뉴스켜기'
            );
        }

        // ── 시세판 ────────────────────────────────
        if (command === '!시세') {
            let mMsg = '📊 [실시간 금융 거래소 시세판]\n\n🏎️ [1. 사치품 호가]\n';
            getLuxuryList().forEach(([name, info], idx) => {
                mMsg += `${idx + 1}. ${name}: ${formatKRW(info.currentPrice)}\n`;
            });
            mMsg += '\n📈 [2. 가상자산 코인 시세]\n';
            for (const [name, info] of Object.entries(COIN_MARKET)) {
                const diff = info.currentPrice - info.lastPrice;
                mMsg += `➔ ${name}: ${formatKRW(info.currentPrice)} (${diff >= 0 ? '🔺 +' : '🔻 '}${formatKRW(Math.abs(diff))}P)\n`;
            }
            return reply(mMsg);
        }

        // ── 상점 ──────────────────────────────────
        if (command === '!상점') {
            let shopMsg = '🛒 [타짜의 만물 상점]\n\n🎯 [1. 전문 장비 매장] (!구매 번호)\n';
            Object.entries(ITEM_SHOP).forEach(([name, info], idx) => {
                shopMsg += `${idx + 1}. ${name} (${formatKRW(info.price)})\n   ㄴ ${info.desc}\n`;
            });
            shopMsg += '\n🏎️ [2. 명품/차량/자산 매장] (!구매 번호)\n';
            getLuxuryList().forEach(([name, info], idx) => {
                shopMsg += `${idx + 1}. ${name} [${info.type}] (${formatKRW(info.currentPrice)})\n`;
            });
            return reply(shopMsg);
        }

        // ── 출석체크 ──────────────────────────────
        if (command === '!출석') {
            const today = new Date().toISOString().split('T')[0];
            if (user.lastCheckIn === today) return reply('⚠️ 오늘 이미 출석했습니다.');
            user.points += 1000;
            user.lastCheckIn = today;
            saveData(db);
            return reply(`🎉 [출석 정착금 지급]\n💵 지급 금액: +1,000P\n💰 보유 잔액: ${formatKRW(user.points)}`);
        }

        // ── 지갑 / 정보 (요청 1, 2: 코인 동적표시 + 변동률) ──
        if (command === '!지갑' || command === '!정보') {
            const items = user.items.length > 0 ? user.items.join(', ') : '없음';

            const luxList = [];
            for (const [name, holding] of Object.entries(user.luxuries)) {
                if (holding.count > 0) {
                    const current = LUXURY_MARKET[name] ? LUXURY_MARKET[name].currentPrice : holding.avgPrice;
                    const rateStr = formatChangeRate(holding.avgPrice, current);
                    luxList.push(`${name}(${holding.count}개, 평단 ${formatKRW(holding.avgPrice)}${rateStr})`);
                }
            }
            const luxDisplay = luxList.length > 0 ? luxList.join('\n   ') : '없음';

            const coinLines = [];
            for (const [name, holding] of Object.entries(user.coins)) {
                if (holding.count > 0) {
                    const current = COIN_MARKET[name] ? COIN_MARKET[name].currentPrice : holding.avgPrice;
                    const rateStr = formatChangeRate(holding.avgPrice, current);
                    coinLines.push(`🪙 ${name}: ${holding.count.toLocaleString()}개 (평단 ${formatKRW(holding.avgPrice)}${rateStr})`);
                }
            }
            const coinDisplay = coinLines.length > 0 ? coinLines.join('\n') : '🪙 보유 코인 없음';

            const empNames = Object.keys(user.employees || {});
            const empDisplay = empNames.length > 0 ? empNames.join(', ') : '없음';
            const nw = calcNetWorth(user);

            return reply(
                `💰 [${sender}님의 종합 자산 정보창]\n` +
                `현금 잔고: ${formatKRW(user.points)}\n` +
                '─────────────────────\n' +
                `🛠 장비: [ ${items} ]\n` +
                `👑 명품: ${luxDisplay}\n` +
                `👔 직원: [ ${empDisplay} ]\n` +
                '─────────────────────\n' +
                coinDisplay + '\n' +
                '─────────────────────\n' +
                `📊 명품 시세가치: ${formatKRW(nw.luxuryValue)}\n` +
                `📊 코인 시세가치: ${formatKRW(nw.coinValue)}\n` +
                `👔 직원 미정산 수익: ${formatKRW(nw.employeeEarning)} (!알바출금으로 받기)\n` +
                `💎 총 자산: ${formatKRW(nw.total)}`
            );
        }

        // ── 자산 랭킹 (요청 10: 0원 제외) ──────────
        if (command === '!랭킹' || command === '!자산랭킹') {
            const allNames = Object.keys(db).filter(name => userExists(db, name));
            if (allNames.length === 0) return reply('❌ 등록된 유저가 없습니다.');

            const ranked = allNames
                .map(name => {
                    const u = ensureUser(db, name);
                    return { name, nw: calcNetWorth(u) };
                })
                .filter(row => row.nw.total > 0) // 총자산 0인 사람 제외
                .sort((a, b) => b.nw.total - a.nw.total)
                .slice(0, 10);

            if (ranked.length === 0) return reply('❌ 자산이 있는 유저가 없습니다.');

            const medals = ['🥇', '🥈', '🥉'];
            let board = '🏆 [실시간 총자산 랭킹 TOP 10]\n─────────────────────\n';
            ranked.forEach((row, idx) => {
                const medal = medals[idx] || `${idx + 1}.`;
                board += `${medal} ${row.name} : ${formatKRW(row.nw.total)}\n`;
            });
            return reply(board);
        }

        // ── 송금 (요청 4, 5: 약어 파서 + 전재산) ───
        if (command === '!송금') {
            if (args.length < 2) return reply('❌ !송금 닉네임 금액\n(예: !송금 홍길동 100만 / !송금 홍길동 전재산)');
            const receiverName = args[0];
            const sendAmount = resolveTransferAmount(args[1], user.points);

            if (Number.isNaN(sendAmount) || sendAmount <= 0 || sender === receiverName ||
                user.points < sendAmount || !userExists(db, receiverName)) {
                return reply(`❌ 송금 실패. 액수 부족 혹은 미가입 대상입니다. (보유: ${formatKRW(user.points)})`);
            }

            const receiver = ensureUser(db, receiverName);
            user.points -= sendAmount;
            receiver.points += sendAmount;
            saveData(db);
            return reply(`💸 [송금 완료]\n💵 이체 금액: -${formatKRW(sendAmount)}\n👤 대상: ${receiverName}님\n💰 내 잔액: ${formatKRW(user.points)}`);
        }

        // ── 사치품(명품) 모두 팔기 ─────────────────
        if (command === '!모두팔기' || command === '!전체판매') {
            const owned = Object.entries(user.luxuries).filter(([, h]) => h.count > 0);
            if (owned.length === 0) return reply('❌ 보유한 사치품이 없습니다.');

            let totalReturn = 0;
            let detail = '';
            for (const [name, holding] of owned) {
                const market = LUXURY_MARKET[name];
                const unitPrice = market ? Math.floor(market.currentPrice * 0.9) : 0;
                const subtotal = unitPrice * holding.count;
                totalReturn += subtotal;
                detail += `➔ ${name} x${holding.count} → +${formatKRW(subtotal)}\n`;
                user.luxuries[name] = { count: 0, avgPrice: 0 };
            }
            user.points += totalReturn;
            saveData(db);

            return reply(
                '💸 [사치품 일괄 매각 완료]\n' +
                '─────────────────────\n' +
                detail +
                '─────────────────────\n' +
                `💵 총 환급액: +${formatKRW(totalReturn)} (수수료 10% 차감)\n` +
                `💰 현재 잔액: ${formatKRW(user.points)}`
            );
        }

        // ── 아이템 / 명품·차량·자산 구매·판매 (평단가 추적) ──
        if (command === '!구매' || command === '!판매') {
            const isBuy = command === '!구매';
            if (args.length < 1) return reply('❌ 번호 또는 품목명을 입력하세요. (!상점 참고)');
            const rawArg = args[0];

            // (1) 전문 장비 (구매만 가능, 고니의구라는 평경장의손 보유 시에만 구매 가능 — 요청 3)
            if (isBuy) {
                const itemName = resolveItemShopName(rawArg);
                if (itemName && ITEM_SHOP[itemName]) {
                    if (itemName === '고니의구라' && !user.items.includes('평경장의손')) {
                        return reply('❌ "고니의구라"는 "평경장의손"을 먼저 보유해야 구매할 수 있습니다.');
                    }
                    const item = ITEM_SHOP[itemName];
                    if (user.items.includes(itemName)) return reply('⚠️ 중복 보유 불가.');
                    if (user.points < item.price) return reply(`❌ 자금 부족. 필요 금액: ${formatKRW(item.price)} (보유: ${formatKRW(user.points)})`);
                    user.points -= item.price;
                    user.items.push(itemName);
                    saveData(db);
                    return reply(`🎁 [장비 구입 성공]\n품목: ${itemName}\n💵 지출 금액: -${formatKRW(item.price)}\n💰 현재 잔액: ${formatKRW(user.points)}`);
                }
            }

            // (2) 명품 / 차량 / 자산 (구매 시 평단가 갱신, 판매 시 평단가 비례 차감)
            const luxName = resolveLuxuryName(rawArg);
            if (luxName && LUXURY_MARKET[luxName]) {
                const marketItem = LUXURY_MARKET[luxName];
                if (!user.luxuries[luxName]) user.luxuries[luxName] = { count: 0, avgPrice: 0 };
                const holding = user.luxuries[luxName];

                if (isBuy) {
                    if (user.points < marketItem.currentPrice) return reply(`❌ 자금 부족. 현 시세: ${formatKRW(marketItem.currentPrice)} (보유: ${formatKRW(user.points)})`);
                    user.points -= marketItem.currentPrice;
                    updateAvgBuy(holding, 1, marketItem.currentPrice);
                    saveData(db);
                    return reply(`🏎️ [FLEX 영입 성사]\n품목: [${luxName}]\n💵 지출 시세: -${formatKRW(marketItem.currentPrice)}\n📊 평단가: ${formatKRW(holding.avgPrice)}\n💰 현재 잔액: ${formatKRW(user.points)}`);
                } else {
                    if (!holding.count || holding.count <= 0) return reply('❌ 보유 자산이 없습니다.');
                    const sellReturn = Math.floor(marketItem.currentPrice * 0.9);
                    holding.count -= 1;
                    if (holding.count === 0) holding.avgPrice = 0;
                    user.points += sellReturn;
                    saveData(db);
                    return reply(`💸 [중고 매각 완료]\n품목: ${luxName}\n💵 환급 금액: +${formatKRW(sellReturn)} (수수료 10% 차감)\n💰 현재 잔액: ${formatKRW(user.points)}`);
                }
            }

            return reply('❌ 존재하지 않는 번호/품목입니다. !상점 으로 목록을 확인하세요.');
        }

        // ── 코인 매수 / 매도 (요청 4, 6, 7: 약어/풀매수/풀매도, 평단가) ──
        if (command === '!매수' || command === '!매도') {
            const isBuy = command === '!매수';
            if (args.length < 2) return reply('❌ 양식 오류. 예: !매수 성빈코인 50억 / !매수 성빈코인 100 / !매수 성빈코인 풀');
            const coinName = args[0];

            if (!COIN_MARKET[coinName]) return reply('❌ 존재하지 않는 코인입니다.');
            const price = COIN_MARKET[coinName].currentPrice;
            if (!user.coins[coinName]) user.coins[coinName] = { count: 0, avgPrice: 0 };
            const holding = user.coins[coinName];

            let amount;
            const amountArg = args[1];

            if (isFullKeyword(amountArg)) {
                // 풀 키워드: 매수=최대수량, 매도=전량
                amount = isBuy ? Math.floor(user.points / price) : holding.count;
            } else {
                const parsed = parseAmount(amountArg);
                if (!Number.isNaN(parsed)) {
                    const hasUnit = /[만억조]/.test(amountArg);
                    if (hasUnit) {
                        // 단위 있는 금액 입력 → 수량으로 변환 (ex: 50억 → 50억/단가)
                        amount = Math.floor(parsed / price);
                    } else {
                        // 단위 없는 숫자 → 수량 직접 입력 (기존 방식)
                        amount = parsed;
                    }
                } else {
                    return reply('❌ 수량 또는 금액을 입력해주세요. 예: !매수 성빈코인 100 / !매수 성빈코인 50억');
                }
            }

            if (Number.isNaN(amount) || amount <= 0) {
                return reply(isBuy
                    ? `❌ 매수 가능한 수량이 없습니다. (보유 현금: ${formatKRW(user.points)})`
                    : '❌ 매도할 수량이 없습니다.');
            }

            if (isBuy) {
                const totalCost = price * amount;
                if (user.points < totalCost) return reply(`❌ 예수금 부족. 필요: ${formatKRW(totalCost)} (보유: ${formatKRW(user.points)})`);
                user.points -= totalCost;
                updateAvgBuy(holding, amount, price);
                saveData(db);
                return reply(
                    `🪙 [코인 매수 체결]\n` +
                    `📈 종목: ${coinName}\n` +
                    `📦 계약 수량: ${amount.toLocaleString()}개\n` +
                    `💵 체결 단가: 각 ${formatKRW(price)}\n` +
                    `💰 총 결제 금액: -${formatKRW(totalCost)}\n` +
                    `📊 평단가: ${formatKRW(holding.avgPrice)}\n` +
                    `💎 내 남은 현금: ${formatKRW(user.points)}`
                );
            } else {
                if (!holding.count || holding.count < amount) return reply(`❌ 보유 물량 부족. (보유: ${(holding.count || 0).toLocaleString()}개)`);
                const totalReturn = price * amount;
                holding.count -= amount;
                if (holding.count === 0) holding.avgPrice = 0;
                user.points += totalReturn;
                saveData(db);
                return reply(
                    `📉 [코인 청산 완료]\n` +
                    `📉 종목: ${coinName}\n` +
                    `📦 처분 수량: ${amount.toLocaleString()}개\n` +
                    `💵 정산 단가: 각 ${formatKRW(price)}\n` +
                    `💰 총 정산 금액: +${formatKRW(totalReturn)}\n` +
                    `💎 내 전체 현금: ${formatKRW(user.points)}`
                );
            }
        }

        // ── 직원 상점 목록 ─────────────────────────
        if (command === '!알바상점') {
            let msg = '👔 [직원 채용 센터]\n─────────────────────\n';
            getEmployeeShopList().forEach(([name, info], idx) => {
                msg += `${idx + 1}. ${name} — 영입가 ${formatKRW(info.hirePrice)}\n   ㄴ 분당 ${formatKRW(info.perMinute)} 수익 (${info.desc})\n`;
            });
            msg += '\n💵 !알바영입 [번호 or 이름]';
            return reply(msg);
        }

        // ── 직원 영입 ──────────────────────────────
        if (command === '!알바영입') {
            if (args.length < 1) return reply('❌ !알바영입 [번호 or 이름]');
            const empName = resolveEmployeeName(args[0]);
            if (!empName) return reply('❌ 존재하지 않는 직원입니다. !알바상점 으로 확인하세요.');
            if (user.employees[empName]) return reply(`⚠️ ${empName}님은 이미 채용 중입니다.`);

            const emp = EMPLOYEE_SHOP[empName];
            if (user.points < emp.hirePrice) return reply(`❌ 자금 부족. 필요 금액: ${formatKRW(emp.hirePrice)} (보유: ${formatKRW(user.points)})`);

            user.points -= emp.hirePrice;
            user.employees[empName] = { hiredAt: Date.now() };
            saveData(db);
            return reply(
                `👔 [채용 완료]\n${empName}님이 입사했습니다!\n` +
                `💵 영입 비용: -${formatKRW(emp.hirePrice)}\n` +
                `📈 분당 수익: ${formatKRW(emp.perMinute)}\n` +
                `💰 현재 잔액: ${formatKRW(user.points)}`
            );
        }

        // ── 보유 직원 / 미정산 수익 확인 ───────────
        if (command === '!알바') {
            const empNames = Object.keys(user.employees || {});
            if (empNames.length === 0) return reply('❌ 보유한 직원이 없습니다. !알바상점 으로 채용해보세요.');

            const now = Date.now();
            let msg = '👔 [내 직원 현황]\n─────────────────────\n';
            let totalEarning = 0;
            empNames.forEach((name, idx) => {
                const emp = EMPLOYEE_SHOP[name];
                const info = user.employees[name];
                if (!emp || !info) return;
                const earning = calcEmployeeEarning(emp, info.hiredAt, now);
                const minutes = Math.floor((now - info.hiredAt) / 60000);
                totalEarning += earning;
                msg += `${idx + 1}. ${name} — 근무 ${minutes}분, 미정산 +${formatKRW(earning)}\n`;
            });
            msg += '─────────────────────\n';
            msg += `💰 총 미정산 수익: ${formatKRW(totalEarning)}\n`;
            msg += '➔ !알바출금 으로 전액 수령 가능';
            return reply(msg);
        }

        // ── 직원 수익 출금 (전체 정산 + 시간 초기화) ───
        if (command === '!알바출금') {
            const empNames = Object.keys(user.employees || {});
            if (empNames.length === 0) return reply('❌ 보유한 직원이 없습니다.');

            const now = Date.now();
            let totalEarning = 0;
            let detail = '';
            empNames.forEach(name => {
                const emp = EMPLOYEE_SHOP[name];
                const info = user.employees[name];
                if (!emp || !info) return;
                const earning = calcEmployeeEarning(emp, info.hiredAt, now);
                totalEarning += earning;
                detail += `➔ ${name}: +${formatKRW(earning)}\n`;
                user.employees[name].hiredAt = now;
            });

            if (totalEarning <= 0) return reply('❌ 정산할 수익이 아직 없습니다. (조금 더 기다려주세요)');

            user.points += totalEarning;
            saveData(db);
            return reply(
                '💵 [직원 수익 출금 완료]\n' +
                '─────────────────────\n' +
                detail +
                '─────────────────────\n' +
                `💰 총 수령액: +${formatKRW(totalEarning)}\n` +
                `💎 현재 잔액: ${formatKRW(user.points)}\n` +
                '⏱️ 모든 직원의 근무 시간이 초기화되었습니다.'
            );
        }

        // ── 직원 해고(판매) ─────────────────────────
        if (command === '!알바판매' || command === '!알바해고') {
            if (args.length < 1) return reply('❌ !알바판매 [번호 or 이름]');
            const empName = resolveOwnedEmployeeName(user, args[0]);
            if (!empName) return reply('❌ 보유하지 않은 직원입니다. !알바 로 확인하세요.');

            const emp = EMPLOYEE_SHOP[empName];
            const info = user.employees[empName];
            const now = Date.now();
            const earning = calcEmployeeEarning(emp, info.hiredAt, now);
            const severance = Math.floor(emp.hirePrice * 0.9);

            delete user.employees[empName];
            user.points += earning + severance;
            saveData(db);

            return reply(
                `👋 [퇴사 처리 완료] ${empName}님이 퇴사했습니다.\n` +
                '─────────────────────\n' +
                `💵 미정산 수익 정산: +${formatKRW(earning)}\n` +
                `💰 퇴직금(영입가 90%): +${formatKRW(severance)} (수수료 10% 차감)\n` +
                '─────────────────────\n' +
                `💎 현재 잔액: ${formatKRW(user.points)}`
            );
        }

        // ── 섯다 판 개설 ──────────────────────────
        if (command === '!섯다') {
            if (gameSessions[room]) return reply('⚠️ 게임이 이미 진행 중입니다.');

            const shuffled = [...DECK].sort(() => Math.random() - 0.5);

            if (user.items.includes('아귀의눈') && Math.random() < 0.05) {
                shuffled[0] = { m: 3, name: '3광' };
                shuffled[1] = { m: 8, name: '8광' };
            }

            const [p1, p2, d1, d2] = shuffled;
            gameSessions[room] = {
                status: 'WAITING_BET',
                player: sender,
                pCards: [p1, p2],
                dCards: [d1, d2],
                pResult: evaluateHand(p1, p2),
                dResult: evaluateHand(d1, d2),
                changesUsed: 0,           // 요청 3: 사용한 패교체 횟수
                maxChanges: getMaxCardChanges(user)  // 요청 3: 보유 기술 기준 최대 횟수
            };

            let earHint = '';
            if (user.items.includes('짝귀의귀') && Math.random() < 0.8) {
                const dScore = gameSessions[room].dResult.score;
                earHint = '\n\n👂 [짝귀의 귀 발동]\n';
                if (dScore >= 2800) earHint += '➔ "\'광땡\'의 기운이야!"';
                else if (dScore >= 2000) earHint += '➔ "\'땡\'의 기운이 묵직해!"';
                else if (dScore >= 1400) earHint += '➔ "중간 족보 무리야!"';
                else if (dScore >= 1001) earHint += '➔ "1끗~9끗 사이야."';
                else earHint += '➔ "\'망통(0끗)\'의 쓰레기야!"';
            }

            const maxChanges = gameSessions[room].maxChanges;
            const changeHint = maxChanges > 0 ? `\n💡 (!바꾸기 입력 시 첫 패 교체, 최대 ${maxChanges}회 가능)` : '';

            const nwSutda = calcNetWorth(user);
            return reply(
                `🎴 [섯다 판 개설]\n\n` +
                `👤 플레이어: ${sender}\n` +
                `🃏 첫 번째 패: [ ${p1.name} ]${earHint}\n\n` +
                `💰 최대 배팅 가능: ${formatKRW(user.points)} (보유 현금)\n` +
                `💎 총 자산: ${formatKRW(nwSutda.total)}\n` +
                `─────────────────────\n` +
                `!배팅 [금액] 으로 배팅하세요. (올인/하프/삥/금액 가능)${changeHint}`
            );
        }

        // ── 패 바꾸기 (요청 3: 횟수 제한) ──────────
        if (command === '!바꾸기') {
            const session = gameSessions[room];
            if (!session || session.player !== sender || session.status !== 'WAITING_BET') return;

            if (session.maxChanges <= 0) return reply('❌ 보유한 타짜기술이 없습니다. (평경장의손이 필요합니다)');
            if (session.changesUsed >= session.maxChanges) {
                return reply(`❌ 패 교체 횟수를 모두 사용했습니다. (최대 ${session.maxChanges}회)`);
            }

            const shuffled = [...DECK].sort(() => Math.random() - 0.5);
            session.pCards[0] = shuffled[0];
            session.pResult = evaluateHand(session.pCards[0], session.pCards[1]);
            session.changesUsed += 1;

            const remaining = session.maxChanges - session.changesUsed;
            return reply(`🎰 [패 교체] 새 패: [ ${session.pCards[0].name} ]\n남은 교체 횟수: ${remaining}회\n배팅을 이어가세요.`);
        }

        // ── 배팅 및 정산 (요청 4, 5, 8: 약어+올인 등+보유금액 안내) ──
        if (command === '!배팅') {
            const session = gameSessions[room];
            if (!session || session.player !== sender) return;
            if (args.length < 1) return reply(`❌ !배팅 금액을 기입하세요. (보유: ${formatKRW(user.points)}, 올인/하프/삥 가능)`);
            const betAmount = resolveBetAmount(args[0], user.points);
            if (Number.isNaN(betAmount) || betAmount <= 0 || user.points < betAmount) {
                return reply(`❌ 배팅 오류. (보유: ${formatKRW(user.points)})`);
            }

            const pRes = session.pResult;
            const dRes = session.dResult;
            let finalMsg =
                '🎴 [섯다 결과]\n' +
                `👤 내 패: [ ${session.pCards[0].name} ][ ${session.pCards[1].name} ] (${pRes.name})\n` +
                `🤖 딜러: [ ${session.dCards[0].name} ][ ${session.dCards[1].name} ] (${dRes.name})\n` +
                '──────────────────\n';

            if (pRes.score > dRes.score) {
                user.points += betAmount;
                finalMsg += `🏆 승리! +${formatKRW(betAmount)}`;
            } else if (pRes.score < dRes.score) {
                user.points -= betAmount;
                finalMsg += `💸 패배... -${formatKRW(betAmount)}`;
            } else {
                finalMsg += '🤝 무승부 비김.';
            }

            saveData(db);
            delete gameSessions[room];
            return reply(`${finalMsg}\n💰 내 지갑: ${formatKRW(user.points)}`);
        }

        // ── 경마: 베팅 판 개설 ─────────────────────
        if (command === '!경마' || command === '!경마시작') {
            if (horseRace) return reply('⚠️ 이미 경마 베팅이 진행 중입니다. (!경마현황 / !경마출발)');
            horseRace = { host: sender, pot: 0, bets: {}, horseTotals: {} };
            let intro = `🐎 [경마 베팅장 개장!] (개장자: ${sender})\n\n📋 출전마 명단\n`;
            for (const h of HORSES) intro += `  ${h.no}번 ${h.name}\n`;
            intro += `\n💵 !경마베팅 [말번호] [금액] 으로 참가 (보유: ${formatKRW(user.points)}, 올인/하프/삥 가능)\n📊 !경마현황  🚦 !경마출발  ❌ !경마취소`;
            return reply(intro);
        }

        // ── 경마: 베팅 참가 (요청 4, 5, 8) ─────────
        if (command === '!경마베팅') {
            if (!horseRace) return reply('❌ 진행 중인 경마 베팅이 없습니다. !경마시작');
            if (args.length < 2) return reply(`❌ 양식: !경마베팅 [말번호] [금액] (보유: ${formatKRW(user.points)})`);
            const horseNo = parseInt(args[0], 10);
            const amount = resolveBetAmount(args[1], user.points);
            if (!HORSES.some(h => h.no === horseNo)) return reply('❌ 말 번호는 1~5 입니다.');
            if (Number.isNaN(amount) || amount <= 0) return reply('❌ 베팅 금액 오류.');
            if (horseRace.bets[sender]) return reply('⚠️ 이미 베팅했습니다. (1인 1마)');
            if (user.points < amount) return reply(`❌ 잔액 부족. 보유: ${formatKRW(user.points)}`);

            user.points -= amount;
            horseRace.pot += amount;
            horseRace.bets[sender] = { horse: horseNo, amount };
            horseRace.horseTotals[horseNo] = (horseRace.horseTotals[horseNo] || 0) + amount;
            saveData(db);

            const horse = HORSES.find(h => h.no === horseNo);
            return reply(`✅ [베팅 접수] ${sender} → ${horseNo}번 ${horse.name}\n💵 베팅액: ${formatKRW(amount)}\n🍯 현재 총 판돈: ${formatKRW(horseRace.pot)}`);
        }

        // ── 경마: 현황판 ────────────────────────────
        if (command === '!경마현황') {
            if (!horseRace) return reply('❌ 진행 중인 경마가 없습니다.');
            let board = `📊 [경마 베팅 현황]\n🍯 총 판돈: ${formatKRW(horseRace.pot)}\n\n`;
            for (const h of HORSES) {
                const total = horseRace.horseTotals[h.no] || 0;
                const odds = total > 0 ? (horseRace.pot / total).toFixed(2) : '—';
                board += `${h.no}번 ${h.name}: ${formatKRW(total)} (배당 x${odds})\n`;
            }
            const players = Object.keys(horseRace.bets);
            board += `\n👥 참가자(${players.length}명): ${players.length ? players.join(', ') : '없음'}`;
            return reply(board);
        }

        // ── 경마: 취소 ──────────────────────────────
        if (command === '!경마취소') {
            if (!horseRace) return reply('❌ 진행 중인 경마가 없습니다.');
            if (horseRace.host !== sender) return reply('❌ 개장자만 취소할 수 있습니다.');
            for (const [name, bet] of Object.entries(horseRace.bets)) ensureUser(db, name).points += bet.amount;
            saveData(db);
            horseRace = null;
            return reply('🛑 [경마 취소] 모든 베팅이 환불되었습니다.');
        }

        // ── 경마: 출발 & 정산 ───────────────────────
        if (command === '!경마출발') {
            if (!horseRace) return reply('❌ 진행 중인 경마가 없습니다.');
            if (Object.keys(horseRace.bets).length < 2) return reply('❌ 최소 2명 이상 참가해야 출발할 수 있습니다.');

            const result = runHorseRace();
            const winnerNo = result.ranked[0].horse.no;
            const winners = Object.entries(horseRace.bets).filter(([, b]) => b.horse === winnerNo);

            let payoutMsg = '';
            if (winners.length === 0) {
                payoutMsg = '\n\n😮 아무도 우승마를 맞히지 못했습니다! (베팅액의 50%만 환급, 하우스 귀속)';
                for (const [name, bet] of Object.entries(horseRace.bets)) {
                    const refund = Math.floor(bet.amount * 0.5);
                    ensureUser(db, name).points += refund;
                    payoutMsg += `\n💸 ${name}: +${formatKRW(refund)} 환급 (-${formatKRW((bet.amount - refund))}P 손실)`;
                }
            } else {
                const winStake = winners.reduce((sum, [, b]) => sum + b.amount, 0);
                payoutMsg = '\n\n💰 [당첨금 정산]';
                for (const [name, bet] of winners) {
                    const payout = Math.floor(horseRace.pot * (bet.amount / winStake));
                    ensureUser(db, name).points += payout;
                    const profit = payout - bet.amount;
                    payoutMsg += `\n🎉 ${name}: +${formatKRW(payout)} (순익 ${profit >= 0 ? '+' : ''}${formatKRW(profit)})`;
                }
            }

            saveData(db);
            const potSnapshot = horseRace.pot;
            horseRace = null;
            return reply(buildRaceBoard(result) + payoutMsg + `\n\n🍯 총 판돈: ${formatKRW(potSnapshot)}`);
        }

        // ── 숫자맞추기: 게임 개설 ──────────────────
        if (command === '!숫자맞추기') {
            if (numberGuessSessions[room]) return reply('⚠️ 이미 진행 중인 숫자맞추기가 있습니다. !숫자배팅 [금액] [숫자] 로 참여하세요.');
            if (args.length < 1) return reply('❌ 양식: !숫자맞추기 [개수(3~8)]\n예: !숫자맞추기 8');

            const n = parseInt(args[0], 10);
            if (Number.isNaN(n) || n < 3 || n > 8) return reply('❌ 개수는 3 ~ 8 사이로 입력해주세요.');

            const multiplier = getNumberGuessMultiplier(n);
            numberGuessSessions[room] = { range: n, multiplier, host: sender };

            return reply(
                `🔢 [숫자맞추기 게임 개설]\n` +
                `👤 개설자: ${sender}\n` +
                `🎯 범위: 1 ~ ${n}\n` +
                `💰 배율: ${multiplier}배\n\n` +
                `💵 !숫자배팅 [금액] [숫자] 로 참여하세요! (보유: ${formatKRW(user.points)}, 올인/하프/삥 가능)\n` +
                `예: !숫자배팅 5000 ${Math.ceil(n / 2)}`
            );
        }

        // ── 숫자맞추기: 배팅 + 숫자 선택 → 즉시 정산 (요청 4, 5, 8) ──
        if (command === '!숫자배팅') {
            const session = numberGuessSessions[room];
            if (!session) return reply('❌ 진행 중인 숫자맞추기가 없습니다. !숫자맞추기 [개수] 로 시작하세요.');
            if (args.length < 2) return reply(`❌ 양식: !숫자배팅 [금액] [숫자] (보유: ${formatKRW(user.points)})`);

            const betAmount = resolveBetAmount(args[0], user.points);
            const guess = parseInt(args[1], 10);

            if (Number.isNaN(betAmount) || betAmount <= 0) return reply('❌ 배팅 금액이 올바르지 않습니다.');
            if (user.points < betAmount) return reply(`❌ 잔액 부족. 보유: ${formatKRW(user.points)}`);
            if (Number.isNaN(guess) || guess < 1 || guess > session.range) {
                return reply(`❌ 숫자는 1 ~ ${session.range} 사이로 입력해주세요.`);
            }

            const answer = Math.floor(Math.random() * session.range) + 1;
            const isWin = guess === answer;

            let resultMsg = `🔢 [숫자맞추기 결과]\n` +
                `🎯 범위: 1 ~ ${session.range}\n` +
                `🤔 ${sender}님의 선택: ${guess}\n` +
                `🎲 정답: ${answer}\n` +
                `──────────────────\n`;

            if (isWin) {
                const payout = Math.floor(betAmount * session.multiplier);
                user.points += payout - betAmount;
                resultMsg += `🏆 정답입니다! 배율 ${session.multiplier}배 적용\n💵 획득: +${formatKRW(payout)}`;
            } else {
                user.points -= betAmount;
                resultMsg += `💸 아쉽네요, 틀렸습니다.\n💵 손실: -${formatKRW(betAmount)}`;
            }

            saveData(db);
            delete numberGuessSessions[room];
            return reply(`${resultMsg}\n💰 내 지갑: ${formatKRW(user.points)}`);
        }

        // ── 숫자맞추기: 취소 (개설자만) ────────────
        if (command === '!숫자맞추기취소') {
            const session = numberGuessSessions[room];
            if (!session) return reply('❌ 진행 중인 숫자맞추기가 없습니다.');
            if (session.host !== sender) return reply('❌ 개설자만 취소할 수 있습니다.');
            delete numberGuessSessions[room];
            return reply('🛑 [숫자맞추기 취소] 게임이 종료되었습니다.');
        }

        // ── 블랙잭: 시작 (요청 4, 5, 8) ─────────────
        if (command === '!블랙잭') {
            if (blackjackSessions[room]) return reply('⚠️ 이미 진행 중인 블랙잭이 있습니다. !히트 / !스탠드 로 진행하세요.');
            if (args.length < 1) return reply(`❌ 양식: !블랙잭 [배팅액] (보유: ${formatKRW(user.points)}, 올인/하프 가능)`);

            const betAmount = resolveBetAmount(args[0], user.points);
            if (Number.isNaN(betAmount) || betAmount <= 0) return reply('❌ 배팅 금액이 올바르지 않습니다.');
            if (user.points < betAmount) return reply(`❌ 잔액 부족. 보유: ${formatKRW(user.points)}`);

            const playerHand = [drawBlackjackCard(), drawBlackjackCard()];
            const dealerHand = [drawBlackjackCard(), drawBlackjackCard()];

            user.points -= betAmount;
            saveData(db);

            const canSplit = playerHand[0].rank === playerHand[1].rank;

            blackjackSessions[room] = {
                player: sender,
                bet: betAmount,
                hands: [{ cards: playerHand, doubled: false, done: false }],
                activeHandIdx: 0,
                dealerHand,
                canFirstAction: true,
                finished: false
            };

            const pScore = calcHandValue(playerHand);
            let msg =
                `🃏 [블랙잭 시작] (배팅 ${formatKRW(betAmount)})\n` +
                `👤 ${sender}님의 패: ${handDisplay(playerHand)} (${pScore})\n` +
                `🤖 딜러 패: ${cardDisplay(dealerHand[0])} 🂠 (1장 비공개)\n\n`;

            if (isBlackjack(playerHand)) {
                const judged = judgeOneHand(playerHand, dealerHand, betAmount, false);
                user.points += betAmount + judged.payout;
                saveData(db);
                delete blackjackSessions[room];
                return reply(
                    msg +
                    `🤖 딜러 패 공개: ${handDisplay(dealerHand)} (${judged.dScore})\n` +
                    `──────────────────\n` +
                    `${resultLabel(judged.resultType)} ${judged.payout >= 0 ? '+' : ''}${formatKRW(judged.payout)}\n` +
                    `💰 내 지갑: ${formatKRW(user.points)}`
                );
            }

            msg += `💵 !히트 (한 장 더) / !스탠드 (멈추기)`;
            if (betAmount <= user.points) msg += ` / !더블다운 (배팅 2배+카드 1장)`;
            if (canSplit) msg += ` / !스플릿 (같은 패 분할)`;

            return reply(msg);
        }

        // ── 블랙잭: 히트 ───────────────────────────
        if (command === '!히트') {
            const session = blackjackSessions[room];
            if (!session || session.player !== sender) return;

            const hand = session.hands[session.activeHandIdx];
            if (!hand || hand.done) return reply('❌ 이미 종료된 패입니다.');

            hand.cards.push(drawBlackjackCard());
            session.canFirstAction = false;
            const score = calcHandValue(hand.cards);

            let msg = `🃏 [히트] ${session.hands.length > 1 ? `(${session.activeHandIdx + 1}번째 패) ` : ''}${handDisplay(hand.cards)} (${score})\n`;

            if (score >= 21) {
                hand.done = true;
                msg += score > 21 ? '💥 버스트! 자동으로 다음 단계로 넘어갑니다.\n' : '✨ 21입니다! 자동 스탠드.\n';
                return reply(msg + advanceBlackjack(db, room, sender));
            }

            msg += '💵 !히트 / !스탠드 로 계속하세요.';
            saveData(db);
            return reply(msg);
        }

        // ── 블랙잭: 스탠드 ─────────────────────────
        if (command === '!스탠드') {
            const session = blackjackSessions[room];
            if (!session || session.player !== sender) return;

            const hand = session.hands[session.activeHandIdx];
            if (!hand || hand.done) return reply('❌ 이미 종료된 패입니다.');

            hand.done = true;
            return reply(`🛑 [스탠드] ${handDisplay(hand.cards)} (${calcHandValue(hand.cards)})\n` + advanceBlackjack(db, room, sender));
        }

        // ── 블랙잭: 더블다운 ───────────────────────
        if (command === '!더블다운') {
            const session = blackjackSessions[room];
            if (!session || session.player !== sender) return;
            if (!session.canFirstAction) return reply('❌ 더블다운은 첫 행동에서만 가능합니다.');

            const hand = session.hands[session.activeHandIdx];
            if (!hand || hand.done) return reply('❌ 이미 종료된 패입니다.');
            if (user.points < session.bet) return reply(`❌ 더블다운에 필요한 자금이 부족합니다. (추가 ${formatKRW(session.bet)} 필요, 보유: ${formatKRW(user.points)})`);

            user.points -= session.bet;
            hand.doubled = true;
            hand.cards.push(drawBlackjackCard());
            hand.done = true;
            session.canFirstAction = false;

            const score = calcHandValue(hand.cards);
            let msg = `💰 [더블다운] 배팅액이 ${formatKRW(session.bet)} 추가되어 총 ${formatKRW((session.bet * 2))}P!\n` +
                `🃏 ${handDisplay(hand.cards)} (${score})${score > 21 ? ' 💥 버스트!' : ''}\n`;

            saveData(db);
            return reply(msg + advanceBlackjack(db, room, sender));
        }

        // ── 블랙잭: 스플릿 ─────────────────────────
        if (command === '!스플릿') {
            const session = blackjackSessions[room];
            if (!session || session.player !== sender) return;
            if (!session.canFirstAction || session.hands.length > 1) return reply('❌ 스플릿은 게임 시작 직후 한 번만 가능합니다.');

            const hand = session.hands[0];
            if (hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank) {
                return reply('❌ 같은 숫자 2장일 때만 스플릿할 수 있습니다.');
            }
            if (user.points < session.bet) return reply(`❌ 스플릿에 필요한 자금이 부족합니다. (추가 ${formatKRW(session.bet)} 필요, 보유: ${formatKRW(user.points)})`);

            user.points -= session.bet;
            saveData(db);

            const card1 = hand.cards[0];
            const card2 = hand.cards[1];

            session.hands = [
                { cards: [card1, drawBlackjackCard()], doubled: false, done: false },
                { cards: [card2, drawBlackjackCard()], doubled: false, done: false }
            ];
            session.activeHandIdx = 0;
            session.canFirstAction = true;

            const h1 = session.hands[0];
            return reply(
                `✂️ [스플릿 완료] 배팅액이 ${formatKRW(session.bet)} 추가되어 총 ${formatKRW((session.bet * 2))}P (각 패당 ${formatKRW(session.bet)})\n\n` +
                `🃏 [1번째 패] ${handDisplay(h1.cards)} (${calcHandValue(h1.cards)})\n` +
                `💵 !히트 / !스탠드 / !더블다운 으로 1번째 패를 먼저 진행하세요.`
            );
        }

        // ── 운영자: 포인트 지급/차감 ───────────────
        if (command === '!관리자지급') {
            if (sender !== ADMIN_NAME) return reply('❌ 운영자 권한이 필요합니다.');
            if (args.length < 2) return reply('❌ 양식: !관리자지급 [닉네임] [금액(음수 가능)]\n예: !관리자지급 홍길동 -50000 / !관리자지급 홍길동 100만');

            const targetName = args[0];
            const amount = parseAmount(args[1]);

            if (Number.isNaN(amount)) return reply('❌ 금액이 올바르지 않습니다.');
            if (!userExists(db, targetName)) return reply(`❌ "${targetName}" 유저를 찾을 수 없습니다.`);

            const target = ensureUser(db, targetName);
            const before = target.points;
            target.points += amount;
            if (target.points < 0) target.points = 0;

            saveData(db);
            return reply(
                `🛡️ [운영자 처리 완료]\n` +
                `👤 대상: ${targetName}\n` +
                `💵 변동: ${amount >= 0 ? '+' : ''}${formatKRW(amount)}\n` +
                `📊 ${formatKRW(before)} → ${formatKRW(target.points)}`
            );
        }

        // ── 운영자: 포인트 강제 설정 ────────────────
        if (command === '!관리자설정') {
            if (sender !== ADMIN_NAME) return reply('❌ 운영자 권한이 필요합니다.');
            if (args.length < 2) return reply('❌ 양식: !관리자설정 [닉네임] [금액]\n예: !관리자설정 홍길동 100만');

            const targetName = args[0];
            const amount = parseAmount(args[1]);

            if (Number.isNaN(amount) || amount < 0) return reply('❌ 금액이 올바르지 않습니다. (0 이상)');
            if (!userExists(db, targetName)) return reply(`❌ "${targetName}" 유저를 찾을 수 없습니다.`);

            const target = ensureUser(db, targetName);
            const before = target.points;
            target.points = amount;

            saveData(db);
            return reply(
                `🛡️ [운영자 처리 완료]\n` +
                `👤 대상: ${targetName}\n` +
                `📊 포인트 강제 설정: ${formatKRW(before)} → ${formatKRW(target.points)}`
            );
        }

        // ── 운영자: 유저 전체 초기화 ─────────────────
        if (command === '!관리자초기화') {
            if (sender !== ADMIN_NAME) return reply('❌ 운영자 권한이 필요합니다.');
            if (args.length < 1) return reply('❌ 양식: !관리자초기화 [닉네임]\n예: !관리자초기화 홍길동');

            const targetName = args[0];
            if (!userExists(db, targetName)) return reply(`❌ "${targetName}" 유저를 찾을 수 없습니다.`);

            const before = ensureUser(db, targetName);
            const beforePoints = before.points;

            db[targetName] = createDefaultUser();

            saveData(db);
            return reply(
                `🛡️ [운영자 처리 완료]\n` +
                `👤 대상: ${targetName}\n` +
                `🔄 전체 초기화 완료 (포인트/명품/코인/직원/장비 전부 리셋)\n` +
                `📊 ${formatKRW(beforePoints)} → 2,000P`
            );
        }

        // ── 기습 퀴즈 정답 검증 ─────────────────────
        if (currentQuiz && content.includes(currentQuiz.a)) {
            if (quizTimer) { clearTimeout(quizTimer); quizTimer = null; }
            currentQuiz = null;
            user.points += 1000;
            saveData(db);
            return reply(`🎊 정답입니다! ${sender}님에게 기습 상금 1,000P가 지급되었습니다!\n💰 내 지갑: ${formatKRW(user.points)}`);
        }

    } catch (e) {
        console.error('통합 엔진 에러:', e);
    }
});

server.bind(PORT);
