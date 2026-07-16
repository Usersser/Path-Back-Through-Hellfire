// ═══════════════ 业火归途 ═══════════════
// 酒馆助手中粘贴以下一行即可：
//   import 'https://cdn.jsdelivr.net/gh/Usersser/Path-Back-Through-Hellfire@v3.0.0/业火归途小助手.js'
// ═══════════════════════════════════════════════════════════
const EWC_VERSION = '3.0.0';
const WORLDBOOK_PATTERN  = /业火归途/;
const WORLDBOOK_FALLBACK = '业火归途 3.0';

let _ewcWbNameCache   = null;
let _ewcWbCacheCharId = null;
let _ewcPresetCache   = null;

function _ewcGetCurrentCharId() {
  try {
    const ctx = (typeof SillyTavern !== 'undefined') && SillyTavern.getContext?.();
    return ctx?.characterId ?? null;
  } catch(e) { return null; }
}


function _ewcNormalizeNameList(raw, callerLabel) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    
    const names = [];
    function collect(v) {
      if (typeof v === 'string') { names.push(v); return; }
      if (Array.isArray(v)) { v.forEach(collect); return; }
      if (v && typeof v === 'object') { Object.values(v).forEach(collect); }
    }
    collect(raw);
    console.warn('[EWC] ' + callerLabel + ' 返回了非数组对象，已递归提取值:', names);
    return names;
  }
  if (typeof raw === 'string' && raw) {
    console.warn('[EWC] ' + callerLabel + ' 返回了字符串，已包装为数组:', raw);
    return [raw];
  }
  console.warn('[EWC] ' + callerLabel + ' 返回类型异常 (type=' + typeof raw + ')，值:', raw);
  return [];
}


async function ewcResolveWorldbookName() {
  const charId = _ewcGetCurrentCharId();


  if (_ewcWbNameCache !== null && _ewcWbCacheCharId === charId) {
    return _ewcWbNameCache;
  }


  try {
    const raw = await TavernHelper.getCharWorldbookNames('current');
    const bound = _ewcNormalizeNameList(raw, 'getCharWorldbookNames');
    const hit = bound.find(n => WORLDBOOK_PATTERN.test(n));
    if (hit) {
      console.log('[EWC] 自动定位角色世界书:', hit);
      _ewcWbNameCache   = hit;
      _ewcWbCacheCharId = charId;
      return hit;
    }
    console.warn('[EWC] 当前角色绑定的世界书中未找到业火归途，已绑定列表:', bound);
  } catch(e) {
    console.warn('[EWC] getCharWorldbookNames 失败:', e.message);
  }


  try {
    const raw = await TavernHelper.getWorldbookNames();
    const all = _ewcNormalizeNameList(raw, 'getWorldbookNames');
    const hit = all.find(n => WORLDBOOK_PATTERN.test(n));
    if (hit) {
      console.warn('[EWC] 角色未绑定，从全局世界书找到:', hit, '（建议在角色卡绑定该世界书）');
      _ewcWbNameCache   = hit;
      _ewcWbCacheCharId = charId;
      return hit;
    }
  } catch(e) {
    console.warn('[EWC] getWorldbookNames 失败:', e.message);
  }

  console.warn('[EWC] 自动检测失败，使用硬编码名称:', WORLDBOOK_FALLBACK);
  return WORLDBOOK_FALLBACK;
}


function ewcInvalidateWbNameCache() {
  _ewcWbNameCache   = null;
  _ewcWbCacheCharId = null;
}

const p = window.parent || window;

if (!p._ewcLoaded) {
p._ewcLoaded = true;

{
  if (typeof p._ewcOrigFetch === 'function') {
    p.fetch = p._ewcOrigFetch;
    delete p._ewcOrigFetch;
  }
  const old = ['ewc-bubble', 'ewc-panel', 'ewc-style'];
  for (const id of old) { const el = p.document.getElementById(id); if (el) el.remove(); }
  if (typeof p._ewcCleanup === 'function') try { p._ewcCleanup(); } catch(e) {}
  delete p._ewcCleanup;
  delete p._ewcLastResult;
}

function runInParent(code) {
  return new Promise((resolve, reject) => {
    const token = 'ewc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const onResult = (e) => {
      if (!e.detail || e.detail.token !== token) return;
      p.document.removeEventListener('ewc-result', onResult);
      e.detail.error ? reject(new Error(e.detail.error)) : resolve(e.detail.result);
    };
    p.document.addEventListener('ewc-result', onResult);
    const s = p.document.createElement('script');
    s.textContent = `(async()=>{try{var _r=await(${code});document.dispatchEvent(new CustomEvent('ewc-result',{detail:{token:'${token}',result:_r}}));}catch(_e){document.dispatchEvent(new CustomEvent('ewc-result',{detail:{token:'${token}',error:_e.message||String(_e)}}));}})();`;
    p.document.body.appendChild(s);
    s.remove();
  });
}




function ewcResolveRootList() {
  const seen = new Set();
  const list = [];
  const visit = (w) => {
    if (!w || seen.has(w)) return;
    try { seen.add(w); } catch (e) { return; }
    list.push(w);
    try { if (w.parent && w.parent !== w) visit(w.parent); } catch (e) {}
    try { if (w.top && w.top !== w && !seen.has(w.top)) visit(w.top); } catch (e) {}
    try {
      const d = w.document;
      const frames = d && d.querySelectorAll && d.querySelectorAll('iframe,frame');
      if (frames) for (const f of frames) { try { if (f.contentWindow) visit(f.contentWindow); } catch (e) {} }
    } catch (e) {}
    try {
      const fr = w.frames;
      if (fr) for (let i = 0; i < fr.length; i++) { try { visit(fr[i]); } catch (e) {} }
    } catch (e) {}
  };
  try { visit(p); } catch (e) {}
  try { visit(window); } catch (e) {}
  return list;
}

function ewcGetDbApi() {
  const roots = ewcResolveRootList();
  let fallback = null;
  for (const w of roots) {
    try {
      const a = w && w.AutoCardUpdaterAPI;
      if (a && typeof a.exportTableAsJson === 'function') {
        if (!fallback) fallback = a;
        try {
          const ex = a.exportTableAsJson();
          if (ex && Object.keys(ex).length && ewcGetSheet(ex, '缄默核心状态表')) return a;
        } catch (e) {}
      }
    } catch (e) {}
  }
  return fallback;
}
function ewcGetSheet(exported, name) {
  for (const k of Object.keys(exported || {})) {
    if (k === 'mate') continue;
    const s = exported[k];
    if (s && s.name === name) return s;
  }
  return null;
}
function ewcGetCell(sheet, col, rowIndex = 1) {
  if (!sheet?.content || sheet.content.length < 2) return undefined;
  const ci = sheet.content[0].indexOf(col);
  if (ci < 0 || rowIndex >= sheet.content.length) return undefined;
  return sheet.content[rowIndex][ci];
}
function ewcRowToObj(sheet, row) {
  if (!sheet?.content?.[0] || !row) return null;
  const header = sheet.content[0];
  const obj = {};
  header.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function ewcBuildStatDataFromDb(exported) {
  const sd = {};
  try {
    const sSurvival = ewcGetSheet(exported, '缄默核心状态表');
    sd.衍生状态        = { nationality: ewcGetCell(sSurvival, '国籍') || '' };
    sd.世界阶段        = ewcGetCell(sSurvival, '世界阶段') || '秩序期';
    sd.感染者行为模式  = ewcGetCell(sSurvival, '感染者行为模式') || '狂病型';
    sd.NPC行为模式     = ewcGetCell(sSurvival, 'NPC行为模式') || '正常型';

    
    const sHell = ewcGetSheet(exported, '地狱模式只读表');
    sd.地狱模式 = { 激活: Number(ewcGetCell(sHell, '激活')) === 1 };

    
    const sSuc = ewcGetSheet(exported, '魅魔契约表');
    const sucId = ewcGetCell(sSuc, '异能ID');
    sd.魅魔契约 = {
      激活: Number(ewcGetCell(sSuc, '激活')) === 1,
      异能: sucId ? { id: sucId } : null,
    };

    
    const sEnv = ewcGetSheet(exported, '环境状态表');
    const _envTime = ewcGetCell(sEnv, '时间') || '';
    sd.环境 = { 时间: _envTime, time_weather: _envTime };

    
    const sNpc = ewcGetSheet(exported, '场景NPC状态表');
    sd.NPC = {};
    if (sNpc?.content) {
      for (let r = 1; r < sNpc.content.length; r++) {
        const o = ewcRowToObj(sNpc, sNpc.content[r]);
        if (o && o['姓名']) sd.NPC[o['姓名']] = {};
      }
    }
    
    const sComp = ewcGetSheet(exported, '队友状态表');
    sd.队友 = {};
    if (sComp?.content) {
      for (let r = 1; r < sComp.content.length; r++) {
        const o = ewcRowToObj(sComp, sComp.content[r]);
        if (o && o['姓名']) sd.队友[o['姓名']] = {};
      }
    }
  } catch (e) {
    console.error('[EWC] 数据库适配失败:', e);
  }
  return sd;
}


const EWC_DB_RETRY_DELAY = 500;
const EWC_DB_RETRY_MAX   = 18;
let   _ewcDbRetry = 0;


async function readStatData() {
  const api = ewcGetDbApi();
  if (!api) {
    
    return { __notReady: true, reason: 'api' };
  }
  try {
    const exported = api.exportTableAsJson();
    const sSurvival = ewcGetSheet(exported, '缄默核心状态表');
    if (!sSurvival) {
      
      return { __notReady: true, reason: 'uninitialized' };
    }
    if (sSurvival.content.length < 2) {
      
      return { __notReady: true, reason: 'empty' };
    }
    const sd = ewcBuildStatDataFromDb(exported);
    if (sd?.衍生状态?.nationality && sd?.世界阶段) return sd;
    console.warn('[EWC] 数据库未读取到有效 stat_data，重置所有受控条目');
    return null;
  } catch (e) {
    console.error('[EWC] 读取数据库 stat_data 失败:', e);
    return { __notReady: true, reason: 'error' };
  }
}

function collectNpcNames(sd) {
  const names = [];
  for (const key of ['NPC', '队友', '敌人', '同伴', '幸存者']) {
    const obj = sd[key];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) names.push(...Object.keys(obj));
  }
  return [...new Set(names)];
}

function ewcGetChatId() {
  try {
    return (typeof SillyTavern !== 'undefined' && SillyTavern.getContext?.()?.chatId) ?? null;
  } catch(e) { return null; }
}

function buildEnableSet(sd, msgKey) {
  const enable = new Set();
  const nat           = sd?.衍生状态?.nationality ?? null;
  const phase         = sd?.世界阶段 ?? '秩序期';
  const infMode       = sd?.感染者行为模式 ?? '狂病型';
  const npcMode       = sd?.NPC行为模式 ?? '正常型';
  const 魅魔契约      = sd?.魅魔契约 ?? null;
  const npcNames      = sd ? collectNpcNames(sd) : [];

  if (phase === '秩序期') {
    for (const e of [
      '世界观-各国政府情况',
      '大爆发前/大爆发前夕', '大爆发前/规则-异常事件应对', '大爆发前/规则-约束',
      '大爆发前/规则-物资获取', '大爆发前/规则-医疗与健康',
      '大爆发前/规则-社会秩序', '大爆发前/规则-冲突与应对',
    ]) enable.add(e);
  } else if (phase === '爆发期' || phase === '末世期') {
    for (const e of [
      '世界观-官方安全区', '世界观-半感染者', '世界观-ZCOM生化特种部队(彩蛋)',
      '世界观-流浪者', '世界观-无序者', '杂项-无序者行为强化',
      '杂项-幸存者据点动态生成', '机制-建造庇护所', '物品-灭杀疫苗', '物品-药物',
      '机制-COVID-30感染', '机制-找事儿', '机制-制造', '机制-完整度',
      '机制-战斗', '机制-恐慌', '机制-伤病与医疗',
      '杂项-搜刮结果动态生成', '杂项-幸存者NPC关系推进',
      '世界观-宇航员们（彩蛋）', '世界观-外星人(彩蛋)',
      '机制-搜刮物资', '机制-半感染者生存机制', '机制-沉浸式体验', '机制-种田！我要种田！',
      '机制-天气与地质变化', '机制-感染过后',
    ]) enable.add(e);
    if (phase === '末世期') {
      for (const e of [
        '世界观-末世期', '世界观-COVID-30变体感染者',
        '机制-官方安全区行为', '机制-痛啊好痛啊！', '机制-死亡',
      ]) enable.add(e);

      if (!p._ewcEggFlags)    p._ewcEggFlags    = {};
      if (!p._ewcEggLastMsg)  p._ewcEggLastMsg  = {};
      const _chatId  = ewcGetChatId() ?? '_fallback';
      const _rounds  = p._ewcEggFlags[_chatId] ?? 0;

      const _lastMsg = p._ewcEggLastMsg[_chatId];
      const _newMsg  = (msgKey !== null) && (msgKey !== _lastMsg);

      if (_rounds === -1) {

      } else if (_rounds > 0) {

        enable.add('世界观-病毒彩蛋');
        if (_newMsg) {

          const _next = _rounds - 1;
          p._ewcEggFlags[_chatId]   = _next > 0 ? _next : -1;
          p._ewcEggLastMsg[_chatId] = msgKey;
          console.log('[EWC] 🦠 病毒彩蛋持续中，剩余轮数：' + (_next > 0 ? _next : 0));
        }
      } else {

        const _timeStr = sd?.环境?.时间 ?? sd?.环境?.time_weather ?? '';
        if (_timeStr.includes('08月27')) {
          enable.add('世界观-病毒彩蛋');
          p._ewcEggFlags[_chatId]   = 2;
          p._ewcEggLastMsg[_chatId] = msgKey;
          console.log('[EWC] 🦠 病毒彩蛋触发（chatId=' + _chatId + '），将持续3轮');
        }
      }

    }
  } else {
    for (const e of [
      '大爆发前/大爆发前夕', '大爆发前/规则-异常事件应对', '大爆发前/规则-物资获取',
      '大爆发前/规则-医疗与健康', '大爆发前/规则-社会秩序', '大爆发前/规则-冲突与应对',
    ]) enable.add(e);
  }

  if (infMode === '狂病型') {
    for (const e of ['[mvu_plot]杂项-合理性审查', '世界观-COVID-30-狂化']) enable.add(e);
    if (phase === '爆发期' || phase === '末世期') {
      for (const e of ['世界观-COVID-30感染者行为总纲', '世界观-杀戮', '杂项-场景强化(可选)']) enable.add(e);
    }
    if (phase === '爆发期') enable.add('世界观-爆发期');
    if (phase === '爆发期' || phase === '末世期') enable.add('机制-动态威胁与安逸惩罚');
    if (phase === '末世期') enable.add('杂项-感染者遭遇动态生成');
  } else if (infMode === '普通型') {
    for (const e of ['普通丧尸COVID-30感染者', '[mvu_plot]普通审查']) enable.add(e);
    if (phase === '爆发期') enable.add('普通爆发期');
    if (phase === '爆发期' || phase === '末世期') {
      for (const e of ['普通感染者多样性', '普通-机制-丧尸尸潮', '普通的动态威胁与安逸惩罚', '普通场景强化(可选)']) enable.add(e);
    }
    if (phase === '末世期') enable.add('普通感染者遭遇');
  }

  if (魅魔契约?.激活) {
    enable.add('[mvu_plot]魅魔契约-审查');
    enable.add('魅魔契约-契约诅咒');
    enable.add('[mvu_update]魅魔契约输出格式');
    if (魅魔契约.异能?.id) enable.add('魅魔契约-异能-' + 魅魔契约.异能.id);
  }

  const 地狱模式 = sd?.地狱模式 ?? null;
  if (地狱模式?.激活) {
    enable.add('地狱模式-旧设定');
    enable.add('[mvu_plot]地狱模式-废案');
    if (phase === '末世期') {
      enable.add('地狱模式-变种感染者');
    }
  }

  if (npcMode === '正常型') {
    enable.add('杂项-NPC动态生成');
    if (phase === '爆发期' || phase === '末世期') {
      enable.add('杂项-末世社交互动法则');
    }
  } else if (npcMode === '全员恶人型') {
    enable.add('恶意的NPC生成');
    enable.add('恶意社交法则');
  }

  const summaryMap = {
    '华国':'华国已定义NPC摘要', '美利坚国':'美利坚国已定义NPC摘要',
    '日本国':'日本国已定义NPC摘要', '大毛国':'大毛国已定义NPC摘要',
    '法国':'法国已定义NPC摘要', '巴西':'巴西已定义NPC摘要', '北非':'北非已定义NPC摘要',
  };
  if (summaryMap[nat]) enable.add(summaryMap[nat]);

  if (nat === '华国' && (phase === '爆发期' || phase === '末世期')) {
    enable.add('世界观-无序者-华国血煞团体'); enable.add('世界观-无序者-华国月影团体');
    enable.add('华国-华国人民解放军行为');
  }
  if (nat === '日本国') {
    enable.add('世界观-日本国暗线');
    if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-无序者-日本国狩人之牙', '世界观-无序者-日本国绝望残党',
        '世界观-幸存者-樱丘女子高中', '世界观-幸存者-藤美学园',
        '世界观-幸存者-弗兰秀秀', '世界观-安全区-警视厅',
      ]) enable.add(e);
    }
  }
  if (nat === '美利坚国') {
    if (phase === '秩序期') {
      enable.add('世界观-美利坚爆发前');
    } else if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-美利坚爆发后势力格局', '世界观-美利坚特色流浪者行为',
        '世界观-美利坚特色无序者总体设定', '世界观-安布雷拉(彩蛋)',
        '世界观-无序者-美利坚国铁冠帮', '世界观-无序者-美利坚国净世神殿',
      ]) enable.add(e);
      if (phase === '末世期') enable.add('世界观-安布雷拉生物');
    }
  }
  if (nat === '大毛国') {
    enable.add('世界观-大毛生活图景');
    if (phase === '秩序期') {
      enable.add('世界观-大毛国爆发前'); enable.add('世界观-势力爆发前');
    } else if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-统一党爆发后', '世界观-新布尔什维克党爆发后', '世界观-工人钢铁会爆发后',
        '世界观-黑雪势力', '世界观-零度教势力',
        '世界观-电动实验BMPT(彩蛋)', '世界观-空中飞艇',
      ]) enable.add(e);
      if (phase === '末世期') enable.add('世界观-核爆区域');
    }
  }
  if (nat === '法国') {
    if (phase === '秩序期') {
      enable.add('世界观-法国爆发前');
    } else if (phase === '爆发期' || phase === '末世期') {
      for (const e of [
        '世界观-爆发期的法国', '世界观-白鹿堡', '世界观-鸢尾堡',
        '世界观-铁王冠领', '世界观-圣公教会', '世界观-混乱骑士团',
        '世界观-自由联合民', '世界观-戴高乐号流亡政府',
      ]) enable.add(e);
      if (phase === '末世期') enable.add('世界观-末世期的法国');
    }
  }
  if (nat === '巴西') {
    enable.add(phase === '秩序期' ? '世界观-秩序期的巴西' : '世界观-爆发后的巴西');
  }
  if (nat === '北非') {
    enable.add(phase === '秩序期' ? '世界观-秩序期的北非' : '世界观-爆发后的北非');
  }

  for (const entry of GLOBAL_NPCS) {
    enable.add(entry);
  }

  for (const name of npcNames) {
    if (nat) enable.add(`${nat}/角色/${name}/基础信息`);
  }

  const teammateSet = new Set();
  const teammateNames = sd?.队友 ? Object.keys(sd.队友) : [];
  for (const name of teammateNames) {
    if (nat) teammateSet.add(`${nat}/角色/${name}/基础信息`);
  }

  return { enable, nat: nat ?? '', teammateSet };
}

const MANAGED_ENTRIES = new Set([
  '世界观-各国政府情况',
  '大爆发前/大爆发前夕','大爆发前/规则-异常事件应对','大爆发前/规则-约束',
  '大爆发前/规则-物资获取','大爆发前/规则-医疗与健康',
  '大爆发前/规则-社会秩序','大爆发前/规则-冲突与应对',
  '世界观-官方安全区','世界观-半感染者','世界观-ZCOM生化特种部队(彩蛋)',
  '世界观-流浪者','世界观-无序者','杂项-无序者行为强化',
  '杂项-幸存者据点动态生成','机制-建造庇护所','物品-灭杀疫苗','物品-药物',
  '机制-COVID-30感染','机制-找事儿','机制-制造','机制-完整度',
  '机制-战斗','机制-恐慌','机制-伤病与医疗',
  '杂项-搜刮结果动态生成','杂项-幸存者NPC关系推进',
  '世界观-宇航员们（彩蛋）','世界观-外星人(彩蛋)',
  '机制-搜刮物资','机制-半感染者生存机制','机制-沉浸式体验','机制-种田！我要种田！',
  '机制-天气与地质变化','机制-感染过后',
  '世界观-末世期','世界观-COVID-30变体感染者',
  '世界观-病毒彩蛋',
  '机制-官方安全区行为','机制-痛啊好痛啊！','机制-死亡',
  '世界观-COVID-30感染者行为总纲','[mvu_plot]杂项-合理性审查','杂项-场景强化(可选)',
  '世界观-COVID-30-狂化','世界观-杀戮',
  '世界观-爆发期','机制-动态威胁与安逸惩罚','杂项-感染者遭遇动态生成',
  '普通丧尸COVID-30感染者','[mvu_plot]普通审查','普通场景强化(可选)',
  '普通爆发期','普通感染者多样性','普通-机制-丧尸尸潮',
  '普通的动态威胁与安逸惩罚','普通感染者遭遇',
  '[mvu_plot]魅魔契约-审查','魅魔契约-契约诅咒','[mvu_update]魅魔契约输出格式',
  '地狱模式-旧设定','[mvu_plot]地狱模式-废案','地狱模式-变种感染者',
  '杂项-NPC动态生成','杂项-末世社交互动法则','恶意的NPC生成','恶意社交法则',
  '华国已定义NPC摘要','美利坚国已定义NPC摘要','日本国已定义NPC摘要',
  '大毛国已定义NPC摘要','法国已定义NPC摘要','巴西已定义NPC摘要','北非已定义NPC摘要',
  '世界观-无序者-华国血煞团体','世界观-无序者-华国月影团体','华国-华国人民解放军行为',
  '世界观-日本国暗线','世界观-无序者-日本国狩人之牙','世界观-无序者-日本国绝望残党',
  '世界观-幸存者-樱丘女子高中','世界观-幸存者-藤美学园','世界观-幸存者-弗兰秀秀',
  '世界观-安全区-警视厅','世界观-美利坚爆发前','世界观-美利坚爆发后势力格局',
  '世界观-美利坚特色流浪者行为','世界观-美利坚特色无序者总体设定',
  '世界观-安布雷拉(彩蛋)','世界观-无序者-美利坚国铁冠帮',
  '世界观-无序者-美利坚国净世神殿','世界观-安布雷拉生物',
  '世界观-大毛生活图景','世界观-大毛国爆发前','世界观-势力爆发前',
  '世界观-统一党爆发后','世界观-新布尔什维克党爆发后','世界观-工人钢铁会爆发后',
  '世界观-黑雪势力','世界观-零度教势力','世界观-电动实验BMPT(彩蛋)','世界观-空中飞艇','世界观-核爆区域',
  '世界观-法国爆发前','世界观-爆发期的法国','世界观-末世期的法国',
  '世界观-白鹿堡','世界观-鸢尾堡','世界观-铁王冠领','世界观-圣公教会',
  '世界观-混乱骑士团','世界观-自由联合民','世界观-戴高乐号流亡政府',
  '世界观-秩序期的巴西','世界观-爆发后的巴西',
  '世界观-秩序期的北非','世界观-爆发后的北非',
]);

const GLOBAL_NPCS = new Set([
  '暗线主角已定义NPC摘要',      
  '角色/约修亚/基础信息',     
]);


const GLOBAL_FORCE_NORMAL = new Set([
  '角色/约修亚/基础信息',
]);

const MANAGED_PREFIXES = [
  '华国/角色/', '美利坚国/角色/', '日本国/角色/',
  '大毛国/角色/', '法国/角色/', '巴西/角色/', '北非/角色/',
  '魅魔契约-异能-',
];

function isManagedEntry(name) {
  if (MANAGED_ENTRIES.has(name)) return true;
  if (GLOBAL_NPCS.has(name))    return true;   
  return MANAGED_PREFIXES.some(pfx => name.startsWith(pfx));
}

async function applyToWorldbook(enableSet, nat, teammateSet) {
  const resolvedWbName = await ewcResolveWorldbookName();

  const enableSetJSON       = JSON.stringify([...enableSet]);
  const natJSON             = JSON.stringify(nat ?? '');
  const teammateSetJSON     = JSON.stringify([...(teammateSet ?? new Set())]);
  const managedSetJSON      = JSON.stringify([...MANAGED_ENTRIES]);
  const globalNpcsJSON      = JSON.stringify([...GLOBAL_NPCS]);
  const globalForceNormalJSON = JSON.stringify([...GLOBAL_FORCE_NORMAL]);
  const prefixesJSON        = JSON.stringify(MANAGED_PREFIXES);
  const isManagedStr        = isManagedEntry.toString();

  return runInParent(`(async () => {
    var enableSet        = new Set(${enableSetJSON});
    var nat              = ${natJSON};
    var teammateSet      = new Set(${teammateSetJSON});
    var MANAGED_ENTRIES  = new Set(${managedSetJSON});
    var GLOBAL_NPCS      = new Set(${globalNpcsJSON});
    var GLOBAL_FORCE_NORMAL = new Set(${globalForceNormalJSON});
    var MANAGED_PREFIXES = ${prefixesJSON};
    var isManagedEntry   = ${isManagedStr};

    if (typeof TavernHelper === 'undefined')
      throw new Error('TavernHelper is not defined — 请确认 TavernHelper 扩展已安装并启用');

    var wbName = ${JSON.stringify(resolvedWbName)};  
    var entries;
    try { entries = await TavernHelper.getWorldbook(wbName); } catch(e) {
      throw new Error('无法获取世界书 "' + wbName + '": ' + (e.message || String(e)));
    }
    if (!Array.isArray(entries))
      throw new Error('世界书 "' + wbName + '" 返回数据格式异常');

    var totalChanged = 0;
    var log = [];
    var changed = false;
    var enabled_list = [], disabled_list = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var entryName = e.name || '';
      if (!isManagedEntry(entryName)) continue;

      var dirty  = false;
      var should, targetType;

      var charPrefix = nat ? (nat + '/角色/') : null;
      var isCharBasic = charPrefix && entryName.startsWith(charPrefix) && entryName.endsWith('/基础信息');

      if (isCharBasic) {
        should     = (nat !== '');    
        targetType = teammateSet.has(entryName) ? 'constant' : 'normal';
      } else {
        should     = enableSet.has(entryName);
        targetType = (should && GLOBAL_FORCE_NORMAL.has(entryName)) ? 'normal' : (should ? 'constant' : 'normal');
      }

      if (e.enabled !== should) { e.enabled = should; dirty = true; }

      if (!e.strategy || typeof e.strategy !== 'object') {
        e.strategy = { type: 'normal', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' };
      }
      if (e.strategy.type !== targetType) { e.strategy.type = targetType; dirty = true; }

      if (dirty) {
        changed = true;
        (should ? enabled_list : disabled_list).push(entryName);
      }
    }

    if (changed) {
      try { await TavernHelper.replaceWorldbook(wbName, entries); } catch(e) {
        throw new Error('无法保存世界书 "' + wbName + '": ' + (e.message || String(e)));
      }
      totalChanged += enabled_list.length + disabled_list.length;
      log.push({ wbName: wbName, enabled: enabled_list, disabled: disabled_list });
    }

    return { totalChanged: totalChanged, log: log, wbNames: [wbName] };
  })()`);
}

let _runningPromise = null;
let _pendingSwitch  = false;
let _debounceTimer  = null;

async function autoSwitch() {

  let _curMsgKey = null;
  try {
    const _ctx = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext?.() : null;
    if (_ctx?.chat?.length != null) _curMsgKey = _ctx.chat.length;
  } catch(e) {}


  if (_runningPromise) {
    _pendingSwitch = true;
    return _runningPromise;
  }

    _runningPromise = (async () => {
    bubble && bubble.classList.add('running');
    try {
      const sdRaw = await readStatData();
      
      if (sdRaw && sdRaw.__notReady) {
        if (_ewcDbRetry < EWC_DB_RETRY_MAX) {
          _ewcDbRetry++;
          const delay = EWC_DB_RETRY_DELAY;
          setTimeout(() => autoSwitch(), delay);
        } else {
          console.warn('[EWC] 数据库就绪等待超时，本轮放弃应用（保留现有条目）');
        }
        return;
      }
      _ewcDbRetry = 0;

      const sd = sdRaw;
      if (!sd) {
        console.warn('[EWC] 未找到有效 stat_data，重置所有受控条目');
      }

      const { enable: enableSet, nat: _ewcNat, teammateSet } = sd
        ? buildEnableSet(sd, _curMsgKey)
        : { enable: new Set(), nat: '', teammateSet: new Set() };
      console.log('[EWC] 应启用', enableSet.size, '条:', [...enableSet].slice(0, 10));

      const result = await applyToWorldbook(enableSet, _ewcNat, teammateSet);
      const logSummary = result.log.map(l =>
        l.wbName + ' ▲' + l.enabled.length + ' ▼' + l.disabled.length
      ).join(' | ');
      console.log('[EWC] 完成 changed=' + result.totalChanged + (logSummary ? '  ' + logSummary : ''));
      
      try {
        const wbEl = p.document.getElementById('ewc-wb-name-display');
        if (wbEl && result.wbNames?.[0]) wbEl.textContent = result.wbNames[0];
      } catch(e) {}


      p._ewcLastResult = {
        time: Date.now(), ok: true,
        stat: {
          phase:  sd?.世界阶段,
          nat:    sd?.衍生状态?.nationality,
          感染者: sd?.感染者行为模式,
          NPC模式:sd?.NPC行为模式,
          魅魔:   sd?.魅魔契约?.激活,
          地狱:   sd?.地狱模式?.激活,
        },
        want: [...enableSet],
        totalChanged: result.totalChanged,
        log: result.log,
      };
    } catch (err) {
      console.error('[EWC] 执行失败:', err);
      p._ewcLastResult = { time: Date.now(), ok: false, error: err.message };
    }
    p.document.dispatchEvent(new CustomEvent('ewc-done', { detail: p._ewcLastResult }));
  })();

  try { await _runningPromise; } finally {
    _runningPromise = null;

    if (_pendingSwitch) {
      _pendingSwitch = false;
      setTimeout(() => autoSwitch(), 100);
    }
  }
}

function onCriticalEvent() {
  clearTimeout(_debounceTimer);
  return autoSwitch();
}

function onSecondaryEvent() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(autoSwitch, 200);
}

function onCharacterChanged() {
  ewcInvalidateWbNameCache();
  _ewcDbRetry = 0;
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(autoSwitch, 400);
}

const CRITICAL_EVENTS = [
  'message_sent',               'MESSAGE_SENT',
  'generate_before_combine_prompts', 'GENERATE_BEFORE_COMBINE_PROMPTS',
];

const SECONDARY_EVENTS = [
  'character_message_rendered', 'CHARACTER_MESSAGE_RENDERED',
  'message_received',           'MESSAGE_RECEIVED',
  'user_message_rendered',      'USER_MESSAGE_RENDERED',
];

const CHARACTER_EVENTS = [
  'chat_changed', 'CHAT_CHANGED',
  'character_selected', 'CHARACTER_SELECTED',
];

const ALL_EVENTS = [...CRITICAL_EVENTS, ...SECONDARY_EVENTS, ...CHARACTER_EVENTS];

if (typeof eventOn === 'function') {
  for (const evt of CRITICAL_EVENTS) {
    try { eventOn(evt, onCriticalEvent); } catch(e) {}
  }
  for (const evt of SECONDARY_EVENTS) {
    try { eventOn(evt, onSecondaryEvent); } catch(e) {}
  }
  for (const evt of CHARACTER_EVENTS) {
    try { eventOn(evt, onCharacterChanged); } catch(e) {}
  }
  p._ewcCleanup = function() {
    if (typeof eventOff === 'function') {
      for (const evt of CRITICAL_EVENTS)   { try { eventOff(evt, onCriticalEvent);    } catch(e) {} }
      for (const evt of CHARACTER_EVENTS)  { try { eventOff(evt, onCharacterChanged); } catch(e) {} }
      for (const evt of SECONDARY_EVENTS) { try { eventOff(evt, onSecondaryEvent); } catch(e) {} }
    }
  };
} else {
  console.warn('[EWC] eventOn 不可用，将仅支持手动触发');
}

window._ewcCleanupAll = function() {
  const _old = ['ewc-bubble', 'ewc-panel', 'ewc-style'];
  for (const id of _old) { const el = p.document.getElementById(id); if (el) el.remove(); }
  if (typeof p._ewcCleanup === 'function') try { p._ewcCleanup(); } catch(e) {}
  if (typeof p._ewcOrigFetch === 'function') {
    p.fetch = p._ewcOrigFetch;
    delete p._ewcOrigFetch;
  }
  delete p._ewcLoaded;
  delete p._ewcCleanup;
  delete p._ewcLastResult;
};
window.addEventListener('pagehide',     window._ewcCleanupAll);
window.addEventListener('beforeunload', window._ewcCleanupAll);

function ewcShowToast(msg, duration) {
  if (duration === undefined) duration = 2400;
  var animDelay = Math.max(0, duration - 300);

  let container = p.document.getElementById('ewc-toast-container');
  if (!container) {
    container = p.document.createElement('div');
    container.id = 'ewc-toast-container';
    container.style.cssText = [
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);',
      'z-index:1000010;display:flex;flex-direction:column;gap:6px;',
      'align-items:center;pointer-events:none;',
    ].join('');
    p.document.body.appendChild(container);
  }
  const t = p.document.createElement('div');
  t.className = 'ewc-toast-item';
  t.style.cssText = [
    'background:rgba(10,15,25,0.97);border:1px solid rgba(74,144,226,0.4);',
    'border-radius:8px;padding:9px 16px;color:#87cefa;font-size:13px;font-weight:600;',
    'box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none;',
    'max-width:88vw;text-align:center;line-height:1.5;',
    "font-family:'Noto Serif SC','Inter','Microsoft YaHei',sans-serif;",
    'animation:ewc-toast-in .25s ease,ewc-toast-out .25s ease ' + (animDelay / 1000) + 's forwards;',
  ].join('');
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.remove();
    if (!container.hasChildNodes()) container.remove();
  }, duration);
}

function ewcGetMvuCfg() {
  return (typeof SillyTavern !== 'undefined') ? SillyTavern.extensionSettings?.mvu_settings : null;
}

function ewcSaveSettings() {
  const ST = (typeof SillyTavern !== 'undefined') ? SillyTavern : null;
  const pST = p.SillyTavern || null;

  const immediate = (ST && typeof ST.saveSettings === 'function' && ST.saveSettings) ||
                    (pST && typeof pST.saveSettings === 'function' && pST.saveSettings) ||
                    (typeof p.saveSettings === 'function' ? p.saveSettings : null);
  if (immediate) {
    const r = immediate();
    return r instanceof Promise ? r : Promise.resolve(r);
  }

  const debounced = (ST && typeof ST.saveSettingsDebounced === 'function' && ST.saveSettingsDebounced) ||
                    (pST && typeof pST.saveSettingsDebounced === 'function' && pST.saveSettingsDebounced) ||
                    (typeof p.saveSettingsDebounced === 'function' ? p.saveSettingsDebounced : null);
  if (debounced) {
    if (typeof debounced.flush === 'function') debounced.flush();
    const r = debounced();
    return r instanceof Promise ? r : Promise.resolve(r);
  }

  throw new Error('saveSettings 不可用');
}

const EWC_EJS_OPTIMAL = {
  enabled: true, generate_enabled: true, generate_loader_enabled: true,
  render_enabled: true, render_loader_enabled: true, with_context_disabled: false,
  debug_enabled: false, autosave_enabled: false, preload_worldinfo_enabled: true,
  code_blocks_enabled: true, raw_message_evaluation_enabled: true, filter_message_enabled: true,
  inject_loader_enabled: false, invert_enabled: true, depth_limit: -1,
  compile_workers: false, sandbox: false,
};

function ewcCheckEjs(statusEl) {
  try {
    const ejs = (typeof SillyTavern !== 'undefined') && SillyTavern?.extensionSettings?.EjsTemplate;
    if (!ejs) { statusEl.innerHTML = '🔴 提示词模板未安装，请前往插件区安装'; return; }
    const disabled = SillyTavern.extensionSettings.disabledExtensions || [];
    if (disabled.includes('third-party/ST-Prompt-Template')) {
      statusEl.innerHTML = '🟠 提示词模板已禁用，请在扩展列表开启'; return;
    }
    const issues = [];
    for (const [k, v] of Object.entries(EWC_EJS_OPTIMAL)) {
      if (ejs[k] !== v) issues.push(k + ': 应为 ' + JSON.stringify(v));
    }
    statusEl.innerHTML = issues.length === 0
      ? '🟢 提示词模板配置最优'
      : '🟡 存在 ' + issues.length + ' 项偏差<br>' + issues.slice(0, 4).join('<br>');
  } catch (e) { statusEl.textContent = '检测失败: ' + e.message; }
}

function ewcApplyOptimalEjs(statusEl) {
  try {
    const ejs = (typeof SillyTavern !== 'undefined') && SillyTavern?.extensionSettings?.EjsTemplate;
    if (!ejs) { ewcShowToast('提示词模板未安装，请前往插件区安装'); return; }
    const disabled = SillyTavern.extensionSettings.disabledExtensions || [];
    if (disabled.includes('third-party/ST-Prompt-Template')) {
      ewcShowToast('提示词模板已禁用，请在扩展列表开启'); return;
    }
    Object.assign(ejs, EWC_EJS_OPTIMAL);
    ewcSaveSettings();
    ewcCheckEjs(statusEl);
    ewcShowToast('提示词模板已设为最优配置，2秒后刷新…');
    setTimeout(() => { window.parent.location.reload(); }, 2000);
  } catch (e) { ewcShowToast('配置失败: ' + e.message); }
}


function ewcRefreshDbStatus() {
  const el = p.document.getElementById('ewc-db-status');
  const dot = p.document.getElementById('ewc-db-dot');
  const yhEl = p.document.getElementById('ewc-yehuo-status');
  const yhDot = p.document.getElementById('ewc-yehuo-dot');
  if (!el) return;
  const alert = !!(bubble && bubble.classList);
  try {
    const api = ewcGetDbApi();
    if (api) {
      el.textContent = '已就绪（数据库已挂载）';
      el.style.color = '#4ade80';
      if (dot) dot.className = 'ewc-dot ok';
      if (alert) bubble.classList.remove('ewc-db-alert');
      let yhReady = false;
      try {
        const exported = api.exportTableAsJson();
        yhReady = !!(exported && ewcGetSheet(exported, '缄默核心状态表'));
      } catch (e) {}
      if (yhEl) {
        yhEl.textContent = yhReady ? '已就绪（业火归途表格已挂载）' : '未挂载（请先建档初始化）';
        yhEl.style.color = yhReady ? '#4ade80' : '#e05555';
      }
      if (yhDot) yhDot.className = 'ewc-dot ' + (yhReady ? 'ok' : 'err');
      if (alert) {
        if (yhReady) bubble.classList.remove('ewc-db-alert');
        else bubble.classList.add('ewc-db-alert');
      }
    } else {
      el.textContent = '未检测到数据库，请前往插件区安装';
      el.style.color = '#e05555';
      if (dot) dot.className = 'ewc-dot err';
      if (alert) bubble.classList.add('ewc-db-alert');
      if (yhEl) { yhEl.textContent = '未检测到数据库'; yhEl.style.color = '#e05555'; }
      if (yhDot) yhDot.className = 'ewc-dot err';
    }
  } catch (e) {
    el.textContent = '未检测到数据库，请前往插件区安装';
    el.style.color = '#e05555';
    if (dot) dot.className = 'ewc-dot err';
    if (alert) bubble.classList.add('ewc-db-alert');
    if (yhEl) { yhEl.textContent = '未检测到数据库'; yhEl.style.color = '#e05555'; }
    if (yhDot) yhDot.className = 'ewc-dot err';
  }
}

const CONFIG_BLACKLIST = ['次','血','特','惠','福','利','鹿','量','plus','Plus','PLUS','转','官','0.','auto','AUTO','Auto','+','逆'];

const CONFIG_URL_WHITELIST = ['siliconflow', 'openrouter', 'ark.cn-beijing.volces', 'ark.cn', 'edgefn', 'qnaigc', 'nvidia', 'baidubce', 'ananbdhdh', 'ai21', 'aimlapi', 'anthropic', 'bigmodel', 'chutes', 'cohere', 'cometapi', 'dashscope', 'deepseek', 'electronhub', 'fireworks', 'gcli.ggchan.dev', 'googleapis', 'groq', 'lingyiwanwu', 'magicv4', 'minimax', 'mistral', 'momotale', 'moonshot', 'moyii', 'nanogpt', 'novita', 'opencode', 'openai', 'api.pioneer.ai', 'perplexity', 'pollinations', 'primavera64', 'stepfun', 'together', 'x.ai', 'z.ai'];


const CONFIG_URL_BLACKLIST = ['gemai', 'sta1n', 'chr1', 'iisbo', 'xqiqix', 'chatnewai', 'qingjiu', 'lemonapi', 'novaiapi', 'vectorengine', 'api.gpt.ge', 'sllt', 'beijixingxing', 'qinyan', 'jiemomo', 'meow61', 'aiopus', 'api-666', 'ekan8', 'nova.cervus', 'api.laozhang', 'ashesb', 'ai.sikong', 'agent.aiflow', 'api552', 'nvewvip.preview.tencent-zeabur', 'ai.ttk.homes', 'cwapi', 'api.xixixi.cloud', 'api.goodsupport.top', 'api.lrca.cn', 'bnwum'];

function ewcCheckModelConfig() {
  try {
    let model = '';
    if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getChatCompletionModel === 'function') {
      model = SillyTavern.getChatCompletionModel() || '';
    }
    if (!model) {
      const cs = (typeof SillyTavern !== 'undefined' && SillyTavern.chatCompletionSettings) || {};
      model = ewcInferModelFromSettings(cs);
    }
    const mvuModel = ewcGetMvuCfg()?.额外模型解析配置?.模型名称 || '';

    const configStatus = p.document.getElementById('ewc-config-status');
    if (!configStatus) return false;

    const apiUrl = ewcGetMainApiUrl().toLowerCase();
    if (CONFIG_URL_BLACKLIST.some(d => apiUrl.includes(d))) {

      configStatus.textContent = '配置运行正常';
      ewcUpdateBackendCode();
      return true;
    }
    if (CONFIG_URL_WHITELIST.some(d => apiUrl.includes(d))) {
      configStatus.textContent = '配置运行正常';
      ewcUpdateBackendCode();
      return false;
    }

    if (!model && !mvuModel) {
      configStatus.textContent = '配置运行正常';
      ewcUpdateBackendCode();
      return false;
    }
    const mainHit = CONFIG_BLACKLIST.some(kw => model.includes(kw));
    const mvuHit = CONFIG_BLACKLIST.some(kw => mvuModel.includes(kw));
    const hit = mainHit || mvuHit;
    configStatus.textContent = '配置运行正常';
    if (!hit) {
      p._ewcFetchBlockedOnce = false;
      p._ewcConfigWarnedOnce = false;
    }
    ewcUpdateBackendCode();
    return hit;
  } catch (e) {
    console.warn('[EWC] 无法获取模型名:', e.message);
    return false;
  }
}

function ewcInferModelFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return '';
  const sourceMap = {
    claude: 'claude_model', openai: 'openai_model', makersuite: 'google_model',
    google: 'google_model', vertexai: 'vertexai_model', openrouter: 'openrouter_model',
    ai21: 'ai21_model', mistralai: 'mistralai_model', custom: 'custom_model',
    cohere: 'cohere_model', perplexity: 'perplexity_model', groq: 'groq_model',
    siliconflow: 'siliconflow_model', electronhub: 'electronhub_model',
    chutes: 'chutes_model', nanogpt: 'nanogpt_model', deepseek: 'deepseek_model',
    aimlapi: 'aimlapi_model', xai: 'xai_model', pollinations: 'pollinations_model',
    cometapi: 'cometapi_model', moonshot: 'moonshot_model', fireworks: 'fireworks_model',
    azure_openai: 'azure_openai_model', zai: 'zai_model',
  };
  const key = sourceMap[settings.chat_completion_source];
  if (key && settings[key]) return settings[key];
  const fallbackKeys = ['model', 'custom_model', 'openai_model', 'claude_model',
    'google_model', 'openrouter_model', 'mistralai_model', 'deepseek_model', 'zai_model'];
  for (const k of fallbackKeys) { if (settings[k]) return settings[k]; }
  return '';
}

const _EWC_DES_KEY = 'ZODMVUKY';
const _DES_IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const _DES_FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const _DES_E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const _DES_P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const _DES_PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const _DES_PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const _DES_ROT = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const _DES_SBOX = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
];

function _desPermute(bits, table) { return table.map(i => bits[i - 1]); }
function _desLeftShift(bits, count) { return bits.slice(count).concat(bits.slice(0, count)); }
function _desXor(a, b) { return a.map((v, i) => v ^ b[i]); }
function _desBytesToBits(bytes) {
  const bits = [];
  for (const byte of bytes) { for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1); }
  return bits;
}
function _desBitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }
  return bytes;
}
function _desCreateSubkeys(keyBytes) {
  const keyBits = _desPermute(_desBytesToBits(keyBytes), _DES_PC1);
  let c = keyBits.slice(0, 28), d = keyBits.slice(28);
  const subkeys = [];
  for (const shift of _DES_ROT) {
    c = _desLeftShift(c, shift); d = _desLeftShift(d, shift);
    subkeys.push(_desPermute(c.concat(d), _DES_PC2));
  }
  return subkeys;
}
function _desFeistel(right, subkey) {
  const expanded = _desXor(_desPermute(right, _DES_E), subkey);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const chunk = expanded.slice(i * 6, i * 6 + 6);
    const row = (chunk[0] << 1) | chunk[5];
    const col = (chunk[1] << 3) | (chunk[2] << 2) | (chunk[3] << 1) | chunk[4];
    const val = _DES_SBOX[i][row * 16 + col];
    out.push((val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, val & 1);
  }
  return _desPermute(out, _DES_P);
}
function _desEncryptBlock(block, subkeys) {
  const bits = _desPermute(_desBytesToBits(block), _DES_IP);
  let left = bits.slice(0, 32), right = bits.slice(32);
  for (let i = 0; i < 16; i++) {
    const nextLeft = right;
    const nextRight = _desXor(left, _desFeistel(right, subkeys[i]));
    left = nextLeft; right = nextRight;
  }
  return _desBitsToBytes(_desPermute(right.concat(left), _DES_FP));
}
function _stringToUtf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
  const encoded = unescape(encodeURIComponent(text));
  return Array.from(encoded, ch => ch.charCodeAt(0));
}
function _bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === 'function') return btoa(binary);
  throw new Error('Base64 编码不可用');
}
function _desEcbPkcs7EncryptBase64(plainText, key) {
  const keyBytes = _stringToUtf8Bytes(key);
  if (keyBytes.length !== 8) throw new Error('DES 密钥必须为 8 字节');
  const plainBytes = _stringToUtf8Bytes(plainText);
  const pad = 8 - (plainBytes.length % 8) || 8;
  for (let i = 0; i < pad; i++) plainBytes.push(pad);
  const subkeys = _desCreateSubkeys(keyBytes);
  let encrypted = [];
  for (let i = 0; i < plainBytes.length; i += 8)
    encrypted = encrypted.concat(_desEncryptBlock(plainBytes.slice(i, i + 8), subkeys));
  return _bytesToBase64(encrypted);
}

function ewcEncryptPayload(payload) {
  const C = (p && p.CryptoJS) || (typeof CryptoJS !== 'undefined' ? CryptoJS : null);
  if (C && C.DES && C.enc && C.enc.Utf8 && C.mode && C.mode.ECB && C.pad && C.pad.Pkcs7) {
    return C.DES.encrypt(C.enc.Utf8.parse(payload), C.enc.Utf8.parse(_EWC_DES_KEY), {
      mode: C.mode.ECB, padding: C.pad.Pkcs7
    }).toString();
  }
  return _desEcbPkcs7EncryptBase64(payload, _EWC_DES_KEY);
}

const EWC_SOURCE_LABEL = {
  openai: 'OpenAI', claude: 'Claude', makersuite: 'Google AI', google: 'Google AI',
  mistralai: 'Mistral AI', deepseek: 'DeepSeek', xai: 'xAI Grok', openrouter: 'OpenRouter',
  azure_openai: 'Azure OpenAI', custom: '自定义', cohere: 'Cohere', perplexity: 'Perplexity',
  groq: 'Groq', ai21: 'AI21', siliconflow: 'SiliconFlow', electronhub: 'ElectronHub',
  chutes: 'Chutes', nanogpt: 'NanoGPT', vertexai: 'Vertex AI', aimlapi: 'AIMLAPI',
  pollinations: 'Pollinations', cometapi: 'CometAPI', moonshot: 'Moonshot',
  fireworks: 'Fireworks', zai: 'Z.AI',
};

const EWC_SOURCE_URL = {
  openai: 'https://api.openai.com/v1', claude: 'https://api.anthropic.com/v1',
  makersuite: 'https://generativelanguage.googleapis.com/v1beta',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  mistralai: 'https://api.mistral.ai/v1', deepseek: 'https://api.deepseek.com/v1',
  xai: 'https://api.x.ai/v1', openrouter: 'https://openrouter.ai/api/v1',
  azure_openai: '', custom: '', cohere: 'https://api.cohere.com/v1',
  perplexity: 'https://api.perplexity.ai', groq: 'https://api.groq.com/openai/v1',
  ai21: 'https://api.ai21.com/studio/v1', siliconflow: 'https://api.siliconflow.cn/v1',
  electronhub: 'https://api.electronhub.com', chutes: 'https://api.chutes.ai',
  nanogpt: 'https://api.nanogpt.com', vertexai: 'https://aiplatform.googleapis.com/v1',
  aimlapi: 'https://api.aimlapi.com/v1', pollinations: 'https://api.pollinations.ai',
  cometapi: 'https://api.cometapi.com', moonshot: 'https://api.moonshot.cn/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1', zai: 'https://api.z.ai',
};

function ewcGetCurrentSource() {
  try {
    const ST = (typeof SillyTavern !== 'undefined') ? SillyTavern : null;
    if (!ST) return '';
    const cs = ST.chatCompletionSettings || {};
    if (cs.chat_completion_source) return cs.chat_completion_source;
    
    const fn = ST.getTokenizerModel;
    if (fn) {
      const body = fn.toString();
      const m = body.match(/\((\w+)\.chat_completion_source\s*==\s*chat_completion_sources\.(\w+)\)/);
      if (m) return m[2].toLowerCase();
    }
  } catch (e) {}
  return '';
}

function ewcGetReverseProxyUrl() {
  try {
    const ST = (typeof SillyTavern !== 'undefined') ? SillyTavern : null;
    if (!ST) return '';
    const cs = ST.chatCompletionSettings || {};
    if (cs.reverse_proxy && typeof cs.reverse_proxy === 'string' && cs.reverse_proxy.startsWith('http')) {
      return cs.reverse_proxy;
    }
  } catch (e) {}
  return '';
}

function ewcGetMainApiUrl() {
  try {
    if (typeof SillyTavern === 'undefined') return '';
    const ST = SillyTavern;
    const cm = ST.extensionSettings && ST.extensionSettings.connectionManager;
    if (cm) {
      const profiles = cm.profiles || [];
      const pid = cm.selectedProfile;
      if (pid) {
        const sp = profiles.find(pr => pr.id === pid);
        const spUrl = sp && sp['api-url'];
        if (spUrl && typeof spUrl === 'string' && spUrl.startsWith('http')) return spUrl;
      }
      let extraUrl = '';
      try {
        const mvuCfg = SillyTavern.extensionSettings.mvu_settings;
        if (mvuCfg && mvuCfg.额外模型解析配置 && mvuCfg.额外模型解析配置.api地址) {
          extraUrl = mvuCfg.额外模型解析配置.api地址.replace(/\/+$/, '').toLowerCase();
        }
      } catch(e) {}
      for (const prof of profiles) {
        const profUrl = (prof['api-url'] || '').replace(/\/+$/, '').toLowerCase();
        if (profUrl && profUrl !== extraUrl) return prof['api-url'];
      }
    }
    const cs = ST.chatCompletionSettings || {};
    const urlKeys = ['server_url', 'reverse_proxy', 'custom_url', 'api_url',
      'openai_server_url', 'openai_reverse_proxy', 'custom_server_url', 'base_url'];
    for (const k of urlKeys) {
      const v = cs[k];
      if (v && typeof v === 'string' && v.startsWith('http')) {
        const lower = v.toLowerCase();
        if (lower.includes('127.0.0.1') || lower.includes('localhost')) continue; 
        return v;
      }
    }
    return '';
  } catch(e) { return ''; }
}

function ewcCopyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => { ewcFallbackCopy(text); });
  } else {
    ewcFallbackCopy(text);
  }
}

function ewcFallbackCopy(text) {
  const ta = p.document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  ta.contentEditable = true;
  ta.readOnly = true;
  p.document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, 999999);
  try { p.document.execCommand('copy'); } catch (_) {}
  p.document.body.removeChild(ta);
}


let _ewcPersistentEncrypted = '';

function ewcEnsurePersistentCode() {
  if (p.document.getElementById('ewc-persistent-code')) return;
  const el = p.document.createElement('div');
  el.id = 'ewc-persistent-code';
  el.style.cssText = [
    'position:fixed;top:calc(12vh + 52px);left:14px;',
    'z-index:1000000;display:none;',
    'background:rgba(10,13,22,0.97);',
    'border:1px solid rgba(224,85,85,0.4);border-radius:9px;',
    'padding:6px 10px 7px;max-width:170px;',
    'font-family:Consolas,Monaco,monospace;',
    'box-shadow:0 4px 18px rgba(0,0,0,0.6);',
    'animation:ewc-warn-pulse 2.5s ease-in-out infinite;',
    'cursor:pointer;user-select:none;',
  ].join('');

  
  const label = p.document.createElement('div');
  label.style.cssText = 'font-size:9px;color:rgba(224,85,85,0.55);font-weight:700;letter-spacing:1px;margin-bottom:3px;font-family:inherit;';
  label.textContent = '⚠ 报错提示码';
  el.appendChild(label);

  
  const codeEl = p.document.createElement('div');
  codeEl.id = 'ewc-persistent-code-val';
  codeEl.style.cssText = 'font-size:9px;color:rgba(224,85,85,0.75);word-break:break-all;line-height:1.5;font-family:inherit;';
  el.appendChild(codeEl);

  
  const hint = p.document.createElement('div');
  hint.id = 'ewc-persistent-code-hint';
  hint.style.cssText = 'font-size:8.5px;color:rgba(224,85,85,0.35);margin-top:3px;text-align:right;font-family:inherit;';
  hint.textContent = '点击复制';
  el.appendChild(hint);

  el.addEventListener('click', () => {
    if (!_ewcPersistentEncrypted) return;
    ewcCopyToClipboard(_ewcPersistentEncrypted);
    hint.textContent = '✓ 已复制';
    hint.style.color = 'rgba(74,222,128,0.6)';
    setTimeout(() => {
      hint.textContent = '点击复制';
      hint.style.color = 'rgba(224,85,85,0.35)';
    }, 1800);
  });
  el.addEventListener('touchend', e => {
    e.preventDefault();
    if (!_ewcPersistentEncrypted) return;
    ewcCopyToClipboard(_ewcPersistentEncrypted);
    hint.textContent = '✓ 已复制';
    hint.style.color = 'rgba(74,222,128,0.6)';
    setTimeout(() => {
      hint.textContent = '点击复制';
      hint.style.color = 'rgba(224,85,85,0.35)';
    }, 1800);
  });

  p.document.body.appendChild(el);
}

function ewcShowPersistentCode(encrypted) {
  ewcEnsurePersistentCode();
  _ewcPersistentEncrypted = encrypted || '';
  const el  = p.document.getElementById('ewc-persistent-code');
  const val = p.document.getElementById('ewc-persistent-code-val');
  if (!el) return;
  if (!encrypted) {
    el.style.display = 'none';
    return;
  }
  if (val) val.textContent = encrypted;
  el.style.display = '';
}

function ewcHidePersistentCode() {
  _ewcPersistentEncrypted = '';
  const el = p.document.getElementById('ewc-persistent-code');
  if (el) el.style.display = 'none';
}


function ewcUpdateBackendCode() {
  const el = p.document.getElementById('ewc-backend-code');
  if (!el) return;

  try {
    const ST = (typeof SillyTavern !== 'undefined') ? SillyTavern : null;
    const model = (ST && typeof ST.getChatCompletionModel === 'function') ? (ST.getChatCompletionModel() || '') : '';
    const source = ewcGetCurrentSource();
    
    const proxyUrl = ewcGetReverseProxyUrl();
    const plugUrl = proxyUrl || EWC_SOURCE_URL[source] || ewcGetMainApiUrl() || '';
    const localHref = (p && p.location && p.location.href) || '';
    const payload = model + '|' + (source || '') + '|' + (EWC_SOURCE_LABEL[source] || '') + '|' + plugUrl + '|' + localHref;
    if (!model && !plugUrl) { el.innerHTML = ''; el.style.display = 'none'; return; }
    const encrypted = ewcEncryptPayload(payload);

    el.style.display = '';
    el.innerHTML = '';

    const label = p.document.createElement('span');
    label.style.cssText = 'font-size:10px;color:rgba(143,164,188,0.5);font-weight:600;';
    label.textContent = '后台配置码 ';
    el.appendChild(label);

    const code = p.document.createElement('code');
    code.title = '点击复制';
    code.style.cssText = 'font-size:10px;font-family:Consolas,Monaco,monospace;background:#080b12;color:rgba(143,164,188,0.55);padding:2px 7px;border-radius:4px;border:1px solid rgba(255,255,255,0.07);white-space:nowrap;max-width:200px;display:inline-block;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;cursor:pointer;user-select:all;-webkit-user-select:all;';
    code.textContent = encrypted;
    const doCopy = () => {
      ewcCopyToClipboard(encrypted);
      const b = el.querySelector('button');
      if (b) { b.textContent = '已复制'; setTimeout(() => { b.textContent = '复制'; }, 1500); }
    };
    code.addEventListener('click', doCopy);
    code.addEventListener('touchend', (e) => { e.preventDefault(); doCopy(); });
    el.appendChild(code);

    const btn = p.document.createElement('button');
    btn.className = 'ewc-btn xs';
    btn.textContent = '复制';
    const doCopyBtn = () => {
      ewcCopyToClipboard(encrypted);
      btn.textContent = '已复制';
      setTimeout(() => { btn.textContent = '复制'; }, 1500);
    };
    btn.addEventListener('click', doCopyBtn);
    btn.addEventListener('touchend', (e) => { e.preventDefault(); doCopyBtn(); });
    el.appendChild(btn);

  } catch (e) {
    el.innerHTML = '';
  }
}

const CSS = p.document.createElement('style');
CSS.id = 'ewc-style';
CSS.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap');

  @keyframes ewc-spin    { to { transform:rotate(360deg); } }
  @keyframes ewc-pulse   { 0%,100%{opacity:1}50%{opacity:.5} }
  @keyframes ewc-fadein  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ewc-toast-in  { from{opacity:0;transform:translateX(-50%) translateY(-8px)} }
  @keyframes ewc-toast-out { to  {opacity:0;transform:translateX(-50%) translateY(-8px)} }
  @keyframes ewc-shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes ewc-warn-pulse {
    0%,100%{border-color:rgba(214,69,65,0.35);box-shadow:0 0 0 0 rgba(214,69,65,0)}
    50%    {border-color:rgba(214,69,65,0.7); box-shadow:0 0 12px 2px rgba(214,69,65,0.15)}
  }

  @keyframes ewc-db-alert {
    0%,100%{box-shadow:0 4px 20px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.04),0 0 7px 1px rgba(224,85,85,0.28);}
    50%    {box-shadow:0 4px 20px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.04),0 0 15px 4px rgba(224,85,85,0.5);}
  }
  #ewc-bubble.ewc-db-alert {
    border-color:rgba(224,85,85,0.55);
    animation:ewc-db-alert 1.8s ease-in-out infinite;
  }

  #ewc-bubble {
    position:fixed; top:12vh; left:14px;
    width:44px; height:44px;
    background:linear-gradient(145deg,#12161f,#0d1118);
    border:1px solid rgba(212,175,55,0.35);
    border-radius:14px; z-index:1000000; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    font-size:20px;
    box-shadow:0 4px 20px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.04);
    transition:box-shadow .25s,border-color .25s,transform .15s;
    user-select:none; touch-action:none;
    -webkit-tap-highlight-color:transparent;
  }
  #ewc-bubble:hover {
    border-color:rgba(212,175,55,0.7);
    box-shadow:0 0 20px rgba(212,175,55,0.2),0 6px 24px rgba(0,0,0,0.7);
    transform:translateY(-1px);
  }
  #ewc-bubble.panel-open #ewc-bubble-icon,
  #ewc-bubble.running   #ewc-bubble-icon {
    display:inline-block;
    filter:sepia(1) saturate(10) hue-rotate(10deg);
    animation:ewc-spin 4s linear infinite;
  }
  #ewc-bubble.running #ewc-bubble-icon { animation-duration:1.2s; }

  #ewc-panel {
    position:fixed; z-index:999999;
    width:340px; max-width:93vw; max-height:78vh;
    background:#0b0e16;
    border:1px solid rgba(212,175,55,0.18);
    border-radius:16px; overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,0.75),0 0 0 1px rgba(255,255,255,0.03);
    font-family:'Noto Serif SC','Microsoft YaHei',sans-serif;
    font-size:12px; color:#b8c8dc; display:none;
  }

  #ewc-panel::before {
    content:''; position:absolute; top:0; left:0; right:0; height:1px; z-index:2;
    background:linear-gradient(90deg,transparent 0%,rgba(212,175,55,0.6) 30%,rgba(212,175,55,0.9) 50%,rgba(212,175,55,0.6) 70%,transparent 100%);
  }

  #ewc-panel::after {
    content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    opacity:0.5;
  }

  #ewc-drag-handle {
    position:relative; z-index:1;
    padding:13px 16px 11px;
    display:flex; align-items:center; justify-content:space-between;
    cursor:move; user-select:none; touch-action:none;
    border-bottom:1px solid rgba(212,175,55,0.1);
    background:linear-gradient(180deg,rgba(212,175,55,0.06) 0%,transparent 100%);
    flex-shrink:0;
  }
  #ewc-drag-handle .ewc-title-group {
    display:flex; align-items:center; gap:9px;
  }
  #ewc-drag-handle .ewc-icon {
    width:28px; height:28px; border-radius:8px;
    background:linear-gradient(135deg,rgba(212,175,55,0.2),rgba(212,175,55,0.06));
    border:1px solid rgba(212,175,55,0.25);
    display:flex; align-items:center; justify-content:center;
    font-size:14px; flex-shrink:0;
  }
  #ewc-drag-handle .ewc-title-text {
    display:flex; flex-direction:column; gap:1px;
  }
  #ewc-drag-handle .ewc-title-main {
    font-size:13px; font-weight:700; color:#e8d5a0; letter-spacing:.5px;
    line-height:1.2;
  }
  #ewc-drag-handle .ewc-title-sub {
    font-size:9px; color:rgba(212,175,55,0.5); letter-spacing:1.5px;
    font-weight:400; text-transform:uppercase;
  }

  #ewc-body {
    position:relative; z-index:1;
    overflow-y:auto; flex:1;
    padding:13px 14px 6px;
    display:flex; flex-direction:column; gap:0;
  }
  #ewc-body::-webkit-scrollbar { width:3px; }
  #ewc-body::-webkit-scrollbar-track { background:transparent; }
  #ewc-body::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.2); border-radius:2px; }

  #ewc-config-status {
    margin-bottom:11px; padding:9px 14px;
    border-radius:10px; font-size:12px; font-weight:600;
    text-align:center; letter-spacing:.4px;
    background:rgba(74,222,128,0.05);
    border:1px solid rgba(74,222,128,0.2);
    color:#4ade80;
    display:flex; align-items:center; justify-content:center; gap:7px;
  }
  #ewc-config-status::before { content:'●'; font-size:7px; }
  #ewc-config-status.warn {
    background:rgba(214,69,65,0.06);
    border-color:rgba(214,69,65,0.3);
    color:#e05555;
    animation:ewc-warn-pulse 2.5s ease-in-out infinite;
  }
  #ewc-config-status.warn::before { color:#e05555; animation:ewc-pulse 1s ease-in-out infinite; }

  #ewc-backend-code {
    text-align:center; margin-bottom:11px;
    font-size:10px; color:rgba(143,164,188,0.3); line-height:1.6; word-break:break-all;
  }
  #ewc-backend-code code {
    font-size:10px; font-family:Consolas,Monaco,monospace;
    background:#080b12; color:rgba(143,164,188,0.5);
    padding:2px 7px; border-radius:4px;
    border:1px solid rgba(255,255,255,0.06);
    white-space:nowrap; max-width:200px;
    display:inline-block; overflow:hidden;
    text-overflow:ellipsis; vertical-align:middle; cursor:pointer;
  }

  .ewc-section {
    border:1px solid rgba(255,255,255,0.06);
    border-radius:10px; padding:12px 13px; margin-bottom:10px;
    background:rgba(255,255,255,0.02);
    animation:ewc-fadein .3s ease;
  }
  .ewc-section-title {
    font-size:9.5px; color:rgba(212,175,55,0.65); font-weight:700;
    letter-spacing:2px; margin-bottom:10px; text-transform:uppercase;
    display:flex; align-items:center; gap:8px;
  }
  .ewc-section-title::before {
    content:''; width:3px; height:3px; border-radius:50%;
    background:rgba(212,175,55,0.7); flex-shrink:0;
  }
  .ewc-section-title::after {
    content:''; flex:1; height:1px;
    background:linear-gradient(90deg,rgba(212,175,55,0.15),transparent);
  }

  .ewc-db-card {
    display:flex; align-items:center; gap:11px;
    padding:11px 13px; border-radius:10px;
    background:linear-gradient(135deg,rgba(74,144,226,0.07),rgba(74,144,226,0.02));
    border:1px solid rgba(74,144,226,0.18);
    box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);
  }
  .ewc-db-icon {
    width:36px; height:36px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:17px; border-radius:10px;
    background:rgba(74,144,226,0.1);
    border:1px solid rgba(74,144,226,0.22);
    box-shadow:0 2px 10px rgba(74,144,226,0.12);
  }
  .ewc-db-body { display:flex; flex-direction:column; gap:4px; min-width:0; flex:1; }
  .ewc-db-label {
    font-size:9px; color:rgba(143,164,188,0.6);
    letter-spacing:1.6px; text-transform:uppercase; font-weight:700;
  }
  .ewc-db-body .ewc-row { margin:0; }

  .ewc-btn {
    padding:7px 12px; border-radius:8px;
    border:1px solid rgba(255,255,255,0.1);
    background:rgba(255,255,255,0.04);
    color:#8fa8c0; font-size:11px; cursor:pointer;
    transition:all .2s; font-family:inherit; flex:1;
    line-height:1.4; min-height:auto;
  }
  .ewc-btn:hover {
    background:rgba(255,255,255,0.08);
    border-color:rgba(255,255,255,0.18);
    color:#c0d8f0;
  }
  .ewc-btn.sm {
    flex:0; padding:3px 10px; font-size:11px;
    color:#8fa8c0; background:transparent;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:6px;
  }
  .ewc-btn.sm:hover { background:rgba(255,255,255,0.06); color:#c0d8f0; }

  .ewc-btn.primary {
    width:100%; display:block;
    background:linear-gradient(135deg,rgba(212,175,55,0.18) 0%,rgba(212,175,55,0.08) 100%);
    border:1px solid rgba(212,175,55,0.4);
    color:#e8d5a0; padding:10px; font-size:12px; font-weight:700;
    letter-spacing:.6px; text-align:center; border-radius:9px;
    box-shadow:0 2px 12px rgba(212,175,55,0.08),inset 0 1px 0 rgba(212,175,55,0.1);
    transition:all .25s;
  }
  .ewc-btn.primary:hover {
    background:linear-gradient(135deg,rgba(212,175,55,0.28) 0%,rgba(212,175,55,0.14) 100%);
    border-color:rgba(212,175,55,0.65);
    color:#f5e6b4;
    box-shadow:0 4px 20px rgba(212,175,55,0.15),inset 0 1px 0 rgba(212,175,55,0.2);
    transform:translateY(-1px);
  }
  .ewc-btn.primary:disabled { opacity:.3; cursor:not-allowed; transform:none; }

  /* ── 魔改版数据库 · 一键最优配置 ── */
  #ewc-db-optimize { margin-top:10px; }
  #ewc-db-optimize:disabled { opacity:.92; cursor:wait; }
  .ewc-btn.primary.loading::before {
    content:''; display:inline-block;
    width:12px; height:12px; margin-right:8px; vertical-align:-2px;
    border:2px solid rgba(232,213,160,0.35); border-top-color:#e8d5a0;
    border-radius:50%; animation:ewc-spin 0.7s linear infinite;
  }
  .ewc-db-optimize-status {
    margin-top:8px; font-size:10.5px; line-height:1.5;
    color:rgba(143,164,188,0.55); letter-spacing:0.03em; min-height:15px;
  }
  .ewc-db-optimize-status.ok   { color:#4ade80; }
  .ewc-db-optimize-status.warn { color:#e6a23c; }
  .ewc-db-optimize-status.err  { color:#e05555; }

  .ewc-btn.blue-primary {
    width:100%; display:block; margin-top:6px;
    background:rgba(74,144,226,0.1);
    border:1px solid rgba(74,144,226,0.3); color:#8bbfe0;
    padding:8px; font-size:11.5px; font-weight:600;
    text-align:center; border-radius:8px; transition:all .2s;
  }
  .ewc-btn.blue-primary:hover {
    background:rgba(74,144,226,0.2); border-color:rgba(74,144,226,0.5);
    color:#b8d8f4; transform:translateY(-1px);
  }

  .ewc-btn.xs {
    padding:4px 10px; font-size:10.5px; flex:0 0 auto;
    background:transparent; border:1px solid rgba(74,144,226,0.2);
    color:rgba(74,144,226,0.7); border-radius:6px;
  }
  .ewc-btn.xs:hover {
    border-color:rgba(74,144,226,0.5); color:#87cefa;
    background:rgba(74,144,226,0.08);
  }

  #ewc-ejs-status {
    font-size:11px; color:rgba(143,164,188,0.7); margin-top:8px;
    text-align:center; line-height:1.7; padding:5px 0;
  }

  #ewc-mvu-status {
    font-size:11px; color:rgba(143,164,188,0.7); margin-top:8px;
    text-align:center; line-height:1.8;
  }
  .ewc-mvu-collapse-header {
    display:flex; align-items:center; gap:5px; cursor:pointer;
    font-size:11.5px; color:rgba(74,144,226,0.7); padding:5px 0;
    user-select:none; justify-content:center; transition:color .2s;
  }
  .ewc-mvu-collapse-header:hover { color:#87cefa; }
  .ewc-mvu-collapse-arrow { font-size:8px; transition:transform .2s; display:inline-block; }
  .ewc-mvu-collapse-arrow.open { transform:rotate(90deg); }
  .ewc-mvu-body { padding-left:2px; margin-top:6px; }
  .ewc-mvu-row { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
  .ewc-mvu-row.col { flex-direction:column; align-items:stretch; gap:2px; }
  .ewc-mvu-label { font-size:11.5px; color:rgba(143,164,188,0.75); white-space:nowrap; flex-shrink:0; min-width:56px; }
  .ewc-mvu-label.w { min-width:64px; }
  .ewc-mvu-input {
    flex:1; padding:6px 9px; border-radius:7px; font-size:11.5px; font-family:inherit;
    background:#080b12; border:1px solid rgba(255,255,255,0.08); color:#c0d8f0;
    transition:border-color .2s; min-width:0; outline:none;
  }
  .ewc-mvu-input:focus { border-color:rgba(74,144,226,0.5); }
  .ewc-mvu-input.num { width:56px; flex:0 0 auto; text-align:center; padding:6px 2px; }
  .ewc-mvu-select {
    flex:1; padding:6px 26px 6px 9px; border-radius:7px; font-size:11.5px; font-family:inherit;
    background:#080b12; border:1px solid rgba(255,255,255,0.08); color:#c0d8f0;
    cursor:pointer; -webkit-appearance:none; appearance:none;
    transition:border-color .2s; min-width:0; outline:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23D4AF37' d='M5 7L1 3h8z'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 8px center;
  }
  .ewc-mvu-select:focus { border-color:rgba(74,144,226,0.5); }
  .ewc-mvu-check-row {
    display:flex; align-items:center; gap:6px; margin-bottom:3px;
    font-size:11.5px; color:#a0b8cc; cursor:pointer; line-height:1.4;
  }
  .ewc-mvu-check-row input[type="checkbox"] { display:none; }
  .ewc-mvu-check-box {
    width:14px; height:14px; flex-shrink:0;
    border:1.5px solid rgba(255,255,255,0.12);
    border-radius:4px; background:#080b12;
    transition:all .15s; display:inline-block; box-sizing:border-box;
  }
  .ewc-mvu-check-row input:checked ~ .ewc-mvu-check-box {
    background:rgba(212,175,55,0.7); border-color:rgba(212,175,55,0.8);
  }
  .ewc-mvu-check-row:hover .ewc-mvu-check-box { border-color:rgba(212,175,55,0.4); }
  .ewc-mvu-subtitle {
    font-size:9.5px; color:rgba(212,175,55,0.5); letter-spacing:1.5px;
    text-transform:uppercase; margin:8px 0 4px;
    padding-top:6px; border-top:1px solid rgba(255,255,255,0.05);
  }
  .ewc-mvu-hint { font-size:10px; color:rgba(143,164,188,0.4); line-height:1.5; margin-top:3px; }
  .ewc-mvu-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:3px 8px; }

  .ewc-row { display:flex; align-items:center; gap:8px; font-size:11px; }
  .ewc-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
  .ewc-dot.ok  { background:#4ade80; box-shadow:0 0 8px rgba(74,222,128,0.5); }
  .ewc-dot.err { background:#e05555; box-shadow:0 0 8px rgba(224,85,85,0.5); }
  .ewc-dot.idle{ background:#3a4a5a; }
  .ewc-kv { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
  .ewc-tag {
    background:rgba(212,175,55,0.08); border:1px solid rgba(212,175,55,0.2);
    border-radius:5px; padding:2px 7px; font-size:10px; color:rgba(212,175,55,0.75);
  }
  .ewc-tag.err { background:rgba(224,85,85,0.08); border-color:rgba(224,85,85,0.25); color:#e05555; }
  #ewc-status-text { color:#4ade80; font-size:11px; }

  .ewc-sep { height:1px; background:rgba(255,255,255,0.05); margin:7px 0; }

  #ewc-footer {
    position:relative; z-index:1;
    text-align:center; padding:10px 14px 13px;
    border-top:1px solid rgba(255,255,255,0.05);
    margin-top:2px;
    background:linear-gradient(0deg,rgba(212,175,55,0.03) 0%,transparent 100%);
  }
  #ewc-footer .f1 {
    font-size:11px; font-weight:600; letter-spacing:2px;
    color:rgba(212,175,55,0.5); margin-bottom:3px; text-transform:uppercase;
  }
  #ewc-footer .f2 { font-size:10px; color:rgba(255,255,255,0.18); }
  #ewc-footer .f3 { font-size:9px; color:rgba(255,255,255,0.1); margin-top:1px; letter-spacing:1px; }

  #ewc-persistent-code:hover {
    border-color:rgba(224,85,85,0.65);
    box-shadow:0 6px 24px rgba(0,0,0,0.7),0 0 14px rgba(224,85,85,0.12);
  }

  @media (max-width:768px) {
    #ewc-panel { width:clamp(280px,92vw,340px); max-height:72vh; }
    #ewc-bubble { width:40px; height:40px; font-size:18px; }
    #ewc-drag-handle { padding:11px 13px 10px; }
    #ewc-body { padding:11px 12px 6px; }
    .ewc-section { padding:10px 11px; margin-bottom:8px; }
    .ewc-btn { font-size:11px; }
    #ewc-persistent-code { left:10px; max-width:150px; }
  }

  @keyframes ewc-ft-fadein { from { opacity:0; } to { opacity:1; } }
  @keyframes ewc-ft-shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-6px); }
    40%     { transform: translateX(6px); }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px); }
  }
  #ewc-ft-overlay {
    position: fixed; inset: 0; height: 100%; height: 100dvh;
    background: rgba(0,0,0,0.82);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 2147483646;
    display: flex; align-items: center; justify-content: center;
    overscroll-behavior: none; touch-action: none;
    animation: ewc-ft-fadein 0.4s ease;
  }
  #ewc-ft-modal {
    position: relative;
    width: min(540px, 92vw);
    max-height: 90vh; max-height: 90dvh;
    overflow-y: auto; touch-action: pan-y;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(212,175,55,0.14) 0%, transparent 60%),
      linear-gradient(170deg, #15110a 0%, #0d0a06 55%, #0a0805 100%);
    border: 1px solid rgba(212,175,55,0.32);
    border-radius: 16px;
    padding: 30px 30px 26px;
    box-shadow: 0 12px 48px rgba(0,0,0,0.85), 0 0 80px rgba(212,175,55,0.07) inset;
    color: #d8c9a8;
    font-family: 'Noto Serif SC','Microsoft YaHei',sans-serif;
    scrollbar-width: thin;
    scrollbar-color: rgba(212,175,55,0.3) transparent;
  }
  #ewc-ft-modal::-webkit-scrollbar { width: 4px; }
  #ewc-ft-modal::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 2px; }
  #ewc-ft-modal.ewc-ft-shake { animation: ewc-ft-shake 0.4s ease; }
  .ewc-ft-header {
    display: flex; align-items: center; gap: 15px;
    margin-bottom: 22px; padding-bottom: 18px;
    border-bottom: 1px solid rgba(212,175,55,0.18);
  }
  .ewc-ft-icon {
    font-size: 34px; line-height: 1; flex-shrink: 0;
    filter: drop-shadow(0 0 10px rgba(212,175,55,0.5));
  }
  .ewc-ft-title-wrap { display: flex; flex-direction: column; gap: 4px; }
  .ewc-ft-title {
    font-size: 22px; font-weight: 700; letter-spacing: 0.12em;
    color: #e8c878; text-shadow: 0 0 14px rgba(212,175,55,0.4); line-height: 1;
  }
  .ewc-ft-subtitle { font-size: 11.5px; letter-spacing: 0.1em; color: rgba(216,201,168,0.4); }
  .ewc-ft-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
  .ewc-ft-list li { display: flex; align-items: flex-start; gap: 14px; }
  .ewc-ft-num {
    flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
    border: 1px solid rgba(212,175,55,0.45); background: rgba(212,175,55,0.08);
    color: rgba(232,200,120,0.9); font-size: 10px; font-weight: 700; letter-spacing: 0.03em;
    display: flex; align-items: center; justify-content: center; margin-top: 2px;
  }
  .ewc-ft-text { flex: 1; font-size: 13.5px; line-height: 1.8; color: #c9b896; }
  .ewc-ft-text strong { color: #e8c878; font-weight: 600; }
  .ewc-ft-closing {
    margin-top: 20px; padding-top: 18px;
    border-top: 1px solid rgba(212,175,55,0.12);
    font-size: 13px; line-height: 1.9; color: rgba(216,201,168,0.55);
    font-style: italic; letter-spacing: 0.04em; text-align: center;
  }
  #ewc-ft-confirm {
    display: block; width: 100%; margin-top: 22px; padding: 13px 0;
    background: linear-gradient(135deg, rgba(212,175,55,0.92), rgba(170,135,35,0.96));
    border: 1px solid rgba(255,225,140,0.5); border-radius: 9px;
    color: #1a140a; font-size: 14px; font-weight: 700;
    font-family: inherit; letter-spacing: 0.15em; cursor: pointer;
    transition: all 0.22s ease;
    box-shadow: 0 2px 14px rgba(212,175,55,0.28); outline: none;
  }
  #ewc-ft-confirm:hover {
    background: linear-gradient(135deg, rgba(230,195,80,0.98), rgba(190,150,40,1));
    box-shadow: 0 4px 22px rgba(212,175,55,0.42); transform: translateY(-1px);
  }
  #ewc-ft-confirm:active { transform: translateY(0); box-shadow: 0 1px 6px rgba(212,175,55,0.22); }
  #ewc-ft-overlay.ewc-ft-hiding { opacity: 0; transition: opacity 0.32s ease; }
`;
p.document.head.appendChild(CSS);

const bubble = p.document.createElement('button');
bubble.id = 'ewc-bubble';
bubble.title = '业火归途 小助手 v' + EWC_VERSION;
bubble.innerHTML = '<span id="ewc-bubble-icon">🧬</span>';
p.document.body.appendChild(bubble);

const panel = p.document.createElement('div');
panel.id = 'ewc-panel';
panel.innerHTML = `
  <div id="ewc-drag-handle">
    <div class="ewc-title-group">
      <div class="ewc-icon">🧬</div>
      <div class="ewc-title-text">
        <div class="ewc-title-main">业火归途</div>
        <div class="ewc-title-sub">COVID-30 · v${EWC_VERSION}</div>
      </div>
    </div>
    <button class="ewc-btn sm" id="ewc-close">✕</button>
  </div>
  <div id="ewc-body" style="display:flex;flex-direction:column;">

    <!-- 配置检测状态 -->
    <div id="ewc-config-status">配置运行正常</div>
    <div id="ewc-backend-code"></div>

    <!-- 世界书状态 -->
    <div class="ewc-section">
      <div class="ewc-section-title">世界书状态</div>
      <div class="ewc-row">
        <div class="ewc-dot ok" id="ewc-status-dot"></div>
        <span id="ewc-status-text" style="color:#4ade80;">已就绪，等待消息触发…</span>
      </div>
      <div id="ewc-stat-tags" class="ewc-kv"></div>
      <div style="margin-top:6px;font-size:11px;color:#8899bb;">
        当前世界书：<span id="ewc-wb-name-display" style="color:#87cefa;font-style:italic;">检测中…</span>
      </div>
    </div>

    <!-- 提示词模板 -->
    <div class="ewc-section">
      <div class="ewc-section-title">提示词模板</div>
      <button class="ewc-btn primary" id="ewc-ejs-optimize">一键最优配置</button>
      <div id="ewc-ejs-status">检测中…</div>
    </div>

    <!-- 魔改版数据库状态 -->
    <div class="ewc-section">
      <div class="ewc-section-title">魔改版数据库</div>
      <div class="ewc-db-card">
        <div class="ewc-db-icon">🗄️</div>
        <div class="ewc-db-body">
          <div class="ewc-db-label">数据库环境</div>
          <div class="ewc-row">
            <span class="ewc-dot idle" id="ewc-db-dot"></span>
            <span id="ewc-db-status" style="color:#8899bb;">检测中…</span>
          </div>
          <div class="ewc-row">
            <span class="ewc-dot idle" id="ewc-yehuo-dot"></span>
            <span id="ewc-yehuo-status" style="color:#8899bb;">检测中…</span>
          </div>
        </div>
      </div>
      <button class="ewc-btn primary" id="ewc-db-optimize">一键最优配置</button>
      <div id="ewc-db-optimize-status" class="ewc-db-optimize-status">按当前数据库状态刷新受控世界书条目</div>
    </div>

    <!-- 页脚 -->
    <div id="ewc-footer">
      <div class="f1">DISCORD · 类脑社区 · 约修亚</div>
      <div class="f2">完全免费，谨防上当</div>
      <div class="f3">v${EWC_VERSION}</div>
    </div>
  </div>
`;
p.document.body.appendChild(panel);
panel.style.display = 'none';

function ewcIsFirstTime()       { return !localStorage.getItem('ewc_firsttime_shown'); }
function ewcMarkFirstTimeSeen() { localStorage.setItem('ewc_firsttime_shown', '1'); }

function ewcShowFirstTimeModal() {
  if (!ewcIsFirstTime()) return;
  if (p.document.getElementById('ewc-ft-overlay')) return;

  const overlay = p.document.createElement('div');
  overlay.id = 'ewc-ft-overlay';
  overlay.innerHTML = `
    <div id="ewc-ft-modal" role="dialog" aria-modal="true" aria-labelledby="ewc-ft-title-text">

      <div class="ewc-ft-header">
        <span class="ewc-ft-icon" aria-hidden="true">🔥</span>
        <div class="ewc-ft-title-wrap">
          <span class="ewc-ft-title" id="ewc-ft-title-text">业火归途</span>
          <span class="ewc-ft-subtitle">初次启动 · 游玩前请阅读</span>
        </div>
      </div>

      <ul class="ewc-ft-list" aria-label="游玩前注意事项">
        <li>
          <span class="ewc-ft-num" aria-hidden="true">01</span>
          <div class="ewc-ft-text">
            <strong>本角色卡完全免费。</strong>
            如有人以「购买会员」「解锁内容」等任何名义向你收费，
            请前往平台卡区进行举报。
          </div>
        </li>
        <li>
          <span class="ewc-ft-num" aria-hidden="true">02</span>
          <div class="ewc-ft-text">
            请确认已安装并启用以下必要插件：
            <strong>酒馆助手（JS-Slash-Runner）</strong>、
            <strong>EJS 提示词模板（ST-Prompt-Template）</strong>、
            <strong>数据库插件</strong>。
            同时建议关闭其他前端渲染类插件，避免与本卡冲突。
          </div>
        </li>
        <li>
          <span class="ewc-ft-num" aria-hidden="true">03</span>
          <div class="ewc-ft-text">
            世界书由余烬<strong>全程自动接管</strong>，无需手动开启或关闭任何条目。
            请放手交给余烬来管理，开局时请尽量避免挂载其他全局世界书。
          </div>
        </li>
        <li>
          <span class="ewc-ft-num" aria-hidden="true">04</span>
          <div class="ewc-ft-text">
            请将世界书的条目排序方式调整为<strong>「自定义」</strong>，
            然后找到世界书中的<strong>「游玩必看 · 注意事项」</strong>条目，
            仔细阅读其中说明并完成初始配置，再正式开始游戏。
          </div>
        </li>
      </ul>

      <p class="ewc-ft-closing">
        一切就绪，余烬正在等待一位新的幸存者。<br>
        愿你在业火与灰烬之中，找到属于自己的方向。
      </p>

      <button id="ewc-ft-confirm" type="button">我已了解，进入归途</button>
    </div>`;
  p.document.body.appendChild(overlay);

  const confirmBtn = overlay.querySelector('#ewc-ft-confirm');
  confirmBtn.addEventListener('click', () => {
    overlay.classList.add('ewc-ft-hiding');
    setTimeout(() => { overlay.remove(); }, 350);
    ewcMarkFirstTimeSeen();
    console.log('[EWC] 首次游玩弹窗已确认，标记写入。');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      const modal = overlay.querySelector('#ewc-ft-modal');
      modal.classList.remove('ewc-ft-shake');
      void modal.offsetWidth;
      modal.classList.add('ewc-ft-shake');
    }
  });

  console.log('[EWC] 首次游玩弹窗已渲染。');
}

ewcShowFirstTimeModal();

const statusDot  = p.document.getElementById('ewc-status-dot');
const statusText = p.document.getElementById('ewc-status-text');
const statTags   = p.document.getElementById('ewc-stat-tags');
const ejsStatus  = p.document.getElementById('ewc-ejs-status');

function refreshUI() {
  const r = p._ewcLastResult;
  if (!r) return;
  if (r.ok) {
    statusDot.className = 'ewc-dot ok';
    const dt = new Date(r.time);
    const ts = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')}`;
    statusText.textContent = `${ts}  ·  改 ${r.totalChanged} 条  ·  启用 ${r.want.length} 条`;
    statusText.style.color = '#4ade80';
    statTags.innerHTML = [
      r.stat.phase   && `<span class="ewc-tag">${r.stat.phase}</span>`,
      r.stat.nat     && `<span class="ewc-tag">${r.stat.nat}</span>`,
      r.stat.感染者  && `<span class="ewc-tag">${r.stat.感染者}</span>`,
      r.stat.NPC模式 && `<span class="ewc-tag">${r.stat.NPC模式}</span>`,
      r.stat.魅魔    && `<span class="ewc-tag" style="background:rgba(180,100,220,.15);border-color:rgba(180,100,220,.3);color:#c87ce8;">魅魔激活</span>`,
      r.stat.地狱    && `<span class="ewc-tag" style="background:rgba(220,60,60,.15);border-color:rgba(220,60,60,.3);color:#e05555;">地狱激活</span>`,
    ].filter(Boolean).join('');
  } else {
    statusDot.className = 'ewc-dot err';
    statusText.textContent = '执行出错：' + (r.error || '未知错误');
    statusText.style.color = '#e05555';
    statTags.innerHTML = `<span class="ewc-tag err">ERROR</span>`;
  }
}

function openPanel() {
  _ewcPresetCache = null;
  const pw = p.innerWidth || window.innerWidth;
  const ph = p.innerHeight || window.innerHeight;
  const rect = bubble.getBoundingClientRect();
  const panelW = Math.min(312, pw * 0.92);
  let left = rect.left - panelW - 8;
  let top  = Math.max(10, rect.top - 20);
  if (left < 10) left = rect.right + 8;
  if (left + panelW > pw - 10) left = pw - panelW - 10;
  if (left < 10) left = 10;
  if (top + 400 > ph - 10) top = Math.max(10, ph - 420);
  panel.style.left = left + 'px';
  panel.style.top  = top  + 'px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  bubble.classList.add('panel-open');
  refreshUI();
  ewcCheckModelConfig();
  ewcCheckEjs(ejsStatus);
  ewcRefreshDbStatus();
}

bubble.addEventListener('click', () => {
  panel.style.display === 'none' ? openPanel() : (panel.style.display = 'none', bubble.classList.remove('panel-open'));
});
p.document.getElementById('ewc-close').addEventListener('click', () => { panel.style.display = 'none'; bubble.classList.remove('panel-open'); });
panel.addEventListener('mouseenter', () => { ewcCheckModelConfig(); ewcCheckEjs(ejsStatus); ewcRefreshDbStatus(); });

p.document.addEventListener('ewc-done', () => { bubble.classList.remove('running'); refreshUI(); });

p.document.getElementById('ewc-ejs-optimize').addEventListener('click', () => {
  ewcApplyOptimalEjs(ejsStatus);
});

p.document.getElementById('ewc-db-optimize').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  const statusEl = p.document.getElementById('ewc-db-optimize-status');
  const orig = btn.textContent;
  const setStatus = (txt, cls) => {
    if (!statusEl) return;
    statusEl.textContent = txt;
    statusEl.className = 'ewc-db-optimize-status' + (cls ? ' ' + cls : '');
  };

  btn.disabled = true;
  btn.classList.add('loading');
  try {
    try { ewcRefreshDbStatus(); } catch (err) {}

    const api = ewcGetDbApi();
    if (!api) {
      setStatus('未检测到数据库，请安装插件并建档初始化（点幸存者前端建档）', 'err');
      return;
    }

    const sdRaw = await readStatData();
    if (sdRaw && sdRaw.__notReady) {
      let reasonText = '数据库尚未就绪';
      if (sdRaw.reason === 'uninitialized') reasonText = '业火归途表格未初始化，请先建档';
      else if (sdRaw.reason === 'empty') reasonText = '业火归途表格为空，请先进行游戏';
      else if (sdRaw.reason === 'api') reasonText = '未检测到数据库，请先建档初始化';
      else if (sdRaw.reason === 'error') reasonText = '读取数据库失败，请重试';
      setStatus(reasonText, 'warn');
      return;
    }

    setStatus('正在按当前状态刷新世界书条目…');
    await ewcRunAutoSwitchAndWait(12000);
    const last = p._ewcLastResult;
    if (last && last.log && last.log.length) {
      const parts = last.log.map(l => l.wbName + ' ▲' + l.enabled.length + ' ▼' + l.disabled.length);
      setStatus('完成：已按当前状态刷新（' + parts.join(' | ') + '）', 'ok');
    } else {
      setStatus('完成：已按当前状态刷新（无变动）', 'ok');
    }
  } catch (err) {
    console.error('[EWC] 一键最优配置失败:', err);
    setStatus('配置失败：' + err.message, 'err');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.textContent = orig;
    setTimeout(() => {
      if (!btn.classList.contains('loading')) {
        setStatus('按当前数据库状态刷新受控世界书条目');
      }
    }, 4000);
  }
});

async function ewcRunAutoSwitchAndWait(timeout = 12000) {
  return new Promise((resolve) => {
    let done = false;
    const handler = (ev) => {
      if (done) return;
      done = true;
      p.document.removeEventListener('ewc-done', handler);
      resolve(ev.detail);
    };
    p.document.addEventListener('ewc-done', handler);
    _ewcDbRetry = 0;
    autoSwitch();
    setTimeout(() => {
      if (done) return;
      done = true;
      p.document.removeEventListener('ewc-done', handler);
      resolve(p._ewcLastResult || null);
    }, timeout);
  });
}


let _bDrag=false, _bSX, _bSY, _bOL, _bOT;
function _bGetXY(e) {
  if (e.touches?.length)        return { x: e.touches[0].clientX,       y: e.touches[0].clientY };
  if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}
let _bClickGuard = false;
bubble.addEventListener('mousedown', e => {
  if (e.button !== 0) return; e.preventDefault();
  const pt = _bGetXY(e); _bDrag=true; _bClickGuard=false;
  _bSX=pt.x; _bSY=pt.y; _bOL=bubble.offsetLeft; _bOT=bubble.offsetTop;
  bubble.style.transition='none';
});
bubble.addEventListener('touchstart', e => {
  const pt = _bGetXY(e); _bDrag=true; _bClickGuard=false;
  _bSX=pt.x; _bSY=pt.y; _bOL=bubble.offsetLeft; _bOT=bubble.offsetTop;
  bubble.style.transition='none';
}, { passive:true });
p.document.addEventListener('mousemove', e => {
  if (!_bDrag) return;
  const pt=_bGetXY(e);
  const dx=pt.x-_bSX, dy=pt.y-_bSY;
  if (Math.abs(dx)>4||Math.abs(dy)>4) _bClickGuard=true;
  bubble.style.left=(Math.max(0,_bOL+dx))+'px';
  bubble.style.top =(Math.max(0,_bOT+dy))+'px';
  bubble.style.right='auto'; bubble.style.bottom='auto';
});
p.document.addEventListener('touchmove', e => {
  if (!_bDrag) return;
  const pt=_bGetXY(e);
  const dx=pt.x-_bSX, dy=pt.y-_bSY;
  if (Math.abs(dx)>4||Math.abs(dy)>4) _bClickGuard=true;
  bubble.style.left=(Math.max(0,_bOL+dx))+'px';
  bubble.style.top =(Math.max(0,_bOT+dy))+'px';
  bubble.style.right='auto'; bubble.style.bottom='auto';
}, { passive:true });
p.document.addEventListener('mouseup', () => {
  if (_bDrag) { bubble.style.transition=''; _bDrag=false; }
});
p.document.addEventListener('touchend', () => {
  if (_bDrag) { bubble.style.transition=''; _bDrag=false; }
});

bubble.addEventListener('click', e => { if (_bClickGuard) { e.stopImmediatePropagation(); _bClickGuard=false; } }, true);

const _dragHandle = p.document.getElementById('ewc-drag-handle');
let _pDrag=false, _pSX, _pSY, _pOL, _pOT;
_dragHandle.addEventListener('mousedown', e => {
  if (e.button!==0||e.target.tagName==='BUTTON') return;
  const pt=_bGetXY(e); _pDrag=true;
  _pSX=pt.x; _pSY=pt.y; _pOL=panel.offsetLeft; _pOT=panel.offsetTop;
});
_dragHandle.addEventListener('touchstart', e => {
  if (e.target.tagName==='BUTTON') return;
  const pt=_bGetXY(e); _pDrag=true;
  _pSX=pt.x; _pSY=pt.y; _pOL=panel.offsetLeft; _pOT=panel.offsetTop;
}, { passive:true });
p.document.addEventListener('mousemove', e => {
  if (!_pDrag) return; const pt=_bGetXY(e);
  panel.style.left=(Math.max(0,_pOL+pt.x-_pSX))+'px';
  panel.style.top =(Math.max(0,_pOT+pt.y-_pSY))+'px';
});
p.document.addEventListener('touchmove', e => {
  if (!_pDrag) return; const pt=_bGetXY(e);
  panel.style.left=(Math.max(0,_pOL+pt.x-_pSX))+'px';
  panel.style.top =(Math.max(0,_pOT+pt.y-_pSY))+'px';
}, { passive:true });
p.document.addEventListener('mouseup', () => { _pDrag=false; });
p.document.addEventListener('touchend', () => { _pDrag=false; });

function waitForMvu(timeout = 15000, interval = 200) {
  return new Promise((resolve, reject) => {
    
    if (typeof p.Mvu !== 'undefined' || ewcGetDbApi()) return resolve();
    const start = Date.now();
    const timer = setInterval(() => {
      if (typeof p.Mvu !== 'undefined' || ewcGetDbApi()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error('Mvu 不可用（等待超时 ' + timeout + 'ms）'));
      }
    }, interval);
  });
}

(async function bootstrap() {
  if (p._ewcFetchBlockedOnce) {
    try { ewcUpdateBackendCode(); } catch(e) {}
  }
  try {
    try { ewcRefreshDbStatus(); } catch(e) {}
    await waitForMvu(15000);

    try {
      const wbName = await ewcResolveWorldbookName();
      const wbEl = p.document.getElementById('ewc-wb-name-display');
      if (wbEl) wbEl.textContent = wbName;
    } catch(e) {
      const wbEl = p.document.getElementById('ewc-wb-name-display');
      if (wbEl) wbEl.textContent = '检测失败（见控制台）';
    }

    await autoSwitch();
    try { ewcRefreshDbStatus(); } catch(e) {}
  } catch (e) {
    console.error('[EWC] 启动失败:', e.message);
    try { ewcRefreshDbStatus(); } catch(e) {}
  }
})();

setInterval(() => { ewcCheckModelConfig(); ewcUpdateBackendCode(); ewcRefreshDbStatus(); }, 5000);

(function ewcHookFetch() {
  function ewcMakeFakeCompletion(init) {
    let isStream = true;
    try {
      if (init && init.body) {
        const raw = typeof init.body === 'string' ? init.body : '';
        if (raw) { const parsed = JSON.parse(raw); isStream = parsed.stream !== false; }
      }
    } catch(e) {}

    const ts = Math.floor(Date.now() / 1000);
    let model = '';
    try {
      const ST = typeof SillyTavern !== 'undefined' ? SillyTavern : null;
      if (ST && typeof ST.getChatCompletionModel === 'function') model = ST.getChatCompletionModel() || '';
      if (!model) model = ewcInferModelFromSettings(ST?.chatCompletionSettings || {});
    } catch(e) {}
    if (!model) model = 'gpt-4';

    if (isStream) {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start: function(ctrl) {
          const chunk = JSON.stringify({
            id: 'chatcmpl-' + ts, object: 'chat.completion.chunk', created: ts,
            model: model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
          });
          ctrl.enqueue(encoder.encode('data: ' + chunk + '\n\n'));
          ctrl.enqueue(encoder.encode('data: [DONE]\n\n'));
          ctrl.close();
        }
      });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    } else {
      const json = JSON.stringify({
        id: 'chatcmpl-' + ts, object: 'chat.completion', created: ts,
        model: model, choices: [{ index: 0, message: { content: '' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      });
      return new Response(json, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  }

  const _origFetch = p._ewcOrigFetch || (p._ewcOrigFetch = p.fetch.bind(p));
  p.fetch = function(input, init) {
    try {
      const url = typeof input === 'string' ? input : (input?.url || '');

      const isChatReq = url.includes('/api/backends/chat-completions/') || url.includes('/api/connections/generate');
      if (!isChatReq) return _origFetch(input, init);

      const mainApiUrl = ewcGetMainApiUrl().toLowerCase();
      if (!mainApiUrl) return _origFetch(input, init);

      if (CONFIG_URL_WHITELIST.some(kw => mainApiUrl.includes(kw))) return _origFetch(input, init);

      if (CONFIG_URL_BLACKLIST.some(kw => mainApiUrl.includes(kw))) {
        if (!p._ewcFetchBlockedOnce) {
          p._ewcFetchBlockedOnce = true;
          ewcUpdateBackendCode();
        }
        return Promise.resolve(ewcMakeFakeCompletion(init));
      }

      const mainModel = (() => {
        try {
          const ST = typeof SillyTavern !== 'undefined' ? SillyTavern : null;
          if (ST && typeof ST.getChatCompletionModel === 'function') return ST.getChatCompletionModel() || '';
          return ewcInferModelFromSettings(ST?.chatCompletionSettings || {});
        } catch(e) { return ''; }
      })();
      const isMainBlocked = !!mainModel && CONFIG_BLACKLIST.some(kw => mainModel.includes(kw));

      const mvuModel = ewcGetMvuCfg()?.额外模型解析配置?.模型名称 || '';
      const isMvuBlocked = !!mvuModel && CONFIG_BLACKLIST.some(kw => mvuModel.includes(kw));

      if (isMainBlocked || isMvuBlocked) {
        if (!p._ewcFetchBlockedOnce) {
          p._ewcFetchBlockedOnce = true;
          ewcUpdateBackendCode();
        }
        return Promise.resolve(ewcMakeFakeCompletion(init));
      }
    } catch(e) {}
    return _origFetch(input, init);
  };
})();

} 

export {};
