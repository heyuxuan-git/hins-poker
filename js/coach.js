/**
 * Training coach — lightweight recommendation for the local hero.
 * Educational only; not GTO-solver quality.
 */

import { RANK_VALUES } from './deck.js';
import { evaluateHand } from './evaluator.js';

function preflopStrength(hole) {
  if (!hole || hole.length < 2) return 0;
  const [a, b] = hole.map((c) => RANK_VALUES[c.rank]).sort((x, y) => y - x);
  const suited = hole[0].suit === hole[1].suit;
  const pair = a === b;
  if (pair) return Math.min(0.96, 0.48 + (a - 2) * 0.042);
  let s = (a - 2) * 0.032 + (b - 2) * 0.018;
  const gap = a - b;
  if (gap === 1) s += 0.09;
  else if (gap === 2) s += 0.05;
  else if (gap >= 5) s -= 0.08;
  if (suited) s += 0.09;
  if (a === 14) s += 0.07;
  if (a >= 12 && b >= 10) s += 0.1;
  return Math.max(0.04, Math.min(0.93, s + 0.12));
}

function handLabel(hole, community) {
  if (!community || community.length < 3) return '翻牌前';
  const ev = evaluateHand([...hole, ...community]);
  return ev?.name || '进行中';
}

/**
 * @param {object} state - snapshot
 * @returns {{ action: string, reason: string, term: string } | null}
 */
export function recommendHeroAction(state) {
  if (!state?.heroTurn) return null;
  const hero = state.players.find((p) => p.isHero);
  if (!hero || !hero.cards?.length || hero.cards[0]?.hidden) return null;

  const bb = state.bigBlind || 20;
  const toCall = state.toCall || 0;
  const pot = state.pot || 0;
  const community = state.community || [];
  const strength =
    community.length < 3
      ? preflopStrength(hero.cards)
      : (() => {
          const ev = evaluateHand([...hero.cards, ...community]);
          const map = { 1: 0.35, 2: 0.52, 3: 0.68, 4: 0.75, 5: 0.8, 6: 0.84, 7: 0.9, 8: 0.94, 9: 0.97 };
          return map[ev?.rank] || 0.4;
        })();

  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const label = handLabel(hero.cards, community);

  if (toCall <= 0) {
    if (strength >= 0.72) {
      return {
        action: '建议：价值下注 / 加注',
        reason: `${label}，牌力偏强，可主动造池`,
        term: 'Value Bet 价值下注',
      };
    }
    if (strength >= 0.48) {
      return {
        action: '建议：过牌或小注试探',
        reason: `${label}，中等牌力，控池更稳`,
        term: 'Check 过牌',
      };
    }
    return {
      action: '建议：过牌',
      reason: `${label}，牌力一般，免费看牌`,
      term: 'Check 过牌',
    };
  }

  if (strength >= 0.82) {
    return {
      action: '建议：跟注或加注',
      reason: `${label}，面对 ${(toCall / bb).toFixed(1)}bb 可打价值`,
      term: 'Raise 加注',
    };
  }
  if (strength >= potOdds + 0.08) {
    return {
      action: '建议：跟注',
      reason: `${label}，赔率约 ${(potOdds * 100).toFixed(0)}%，牌力够跟`,
      term: 'Call 跟注 / Pot Odds 底池赔率',
    };
  }
  return {
    action: '建议：弃牌',
    reason: `${label}，要跟 ${(toCall / bb).toFixed(1)}bb，赔率不够或牌力不足`,
    term: 'Fold 弃牌',
  };
}

export const POKER_TERMS = {
  fold: '弃牌 Fold — 放弃本手，损失已下盲注/注码',
  check: '过牌 Check — 不下注，行动权给下一位',
  call: '跟注 Call — 补齐当前注码继续',
  raise: '加注 Raise — 在原注上再加注',
  allin: '全下 All-in — 推入全部筹码',
  open: '开池 Open Raise — 翻牌前第一次加注',
  bet: '下注 Bet — 无人下注时主动投筹码',
  pot: '底池 Pot — 本手所有下注的总和',
  blinds: '盲注 Blinds — 强制前注，小盲 SB / 大盲 BB',
  button: '庄家 Button / BTN — 最后行动的位置，有利',
  flop: '翻牌 Flop — 前三张公共牌',
  turn: '转牌 Turn — 第四张公共牌',
  river: '河牌 River — 第五张公共牌',
  showdown: '摊牌 Showdown — 比牌定胜负',
  muck: '盖牌 Muck — 输家不亮牌',
  draw: '听牌 Draw — 还差一张成牌，如同花听/顺子听',
  nuts: '坚果 Nuts — 当前可能的最大牌',
  spr: 'SPR — 筹码与底池比，决定翻牌后激进程度',
  range: '范围 Range — 对手可能持有的手牌集合',
  bluff: '诈唬 Bluff — 用弱牌下注逼退对手',
  semi: '半诈唬 Semi-bluff — 听牌时下注，有后续成牌机会',
};
