// ============================================================
// PF2e Remaster 日本語ツール — メインアプリケーション
// ============================================================
(function () {
	'use strict';

	// ─── 状態管理 ───
	const ST = {
		step: 0,
		char: {
			name: '',
			ancestry: null,
			heritage: null,
			background: null,
			cls: null,
			abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
			skills: [],
			feats: [],
			spells: [],
			equipment: [],
			level: 1,
			hp: 0,
			ac: 10,
			speed: 25,
		},
	};

	const STEPS = [
		{ title: '1. 名前とレベル' },
		{ title: '2. 祖先の選択' },
		{ title: '3. 遺産の選択' },
		{ title: '4. 背景の選択' },
		{ title: '5. クラスの選択' },
		{ title: '6. 能力値の決定' },
		{ title: '7. 特技の選択' },
		{ title: '8. 呪文の選択' },
		{ title: '9. 装備の選択' },
		{ title: '10. 完成!' },
	];

	// ─── 初期化 ───
	document.addEventListener('DOMContentLoaded', init);

	function init() {
		setupTabs();
		setupGM();
		setupCreator();
		setupRef();
		setupSettings();
		document.getElementById('dataCount').textContent = DB.totalEntries();
	}

	// ─── タブ切り替え ───
	function setupTabs() {
		document.querySelectorAll('.tab-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				document
					.querySelectorAll('.tab-btn')
					.forEach((b) => b.classList.remove('active'));
				document
					.querySelectorAll('.tab-content')
					.forEach((t) => t.classList.remove('active'));
				btn.classList.add('active');
				document
					.getElementById('tab-' + btn.dataset.tab)
					.classList.add('active');
			});
		});
	}

	// ════════════════════════════════════
	// GM モード
	// ════════════════════════════════════
	function setupGM() {
		const container = document.getElementById('gm-topics');
		DB.gmTopics.forEach((t) => {
			const btn = document.createElement('button');
			btn.textContent = t.name;
			btn.addEventListener('click', () =>
				addChat('sys', `【${t.name}】${t.desc}`),
			);
			container.appendChild(btn);
		});
		document.getElementById('chatSend').addEventListener('click', sendChat);
		document.getElementById('chatInput').addEventListener('keydown', (e) => {
			if (e.key === 'Enter') sendChat();
		});
	}

	function addChat(role, text) {
		const log = document.getElementById('chatLog');
		const div = document.createElement('div');
		div.className = 'chat-msg ' + role;
		div.textContent = text;
		log.appendChild(div);
		log.scrollTop = log.scrollHeight;
	}

	async function sendChat() {
		const input = document.getElementById('chatInput');
		const msg = input.value.trim();
		if (!msg) return;
		input.value = '';
		addChat('user', msg);

		const provider = localStorage.getItem('pf2e_ai_provider') || 'openai';
		const apiKey = localStorage.getItem('pf2e_ai_key') || '';

		if (!apiKey) {
			addChat(
				'sys',
				'APIキーが未設定です。設定タブからキーを入力してください。\n\n代わりにローカルデータから回答します：',
			);
			localAnswer(msg);
			return;
		}

		addChat('sys', '考え中…');

		try {
			let reply = '';
			const systemPrompt =
				'あなたはPathfinder 2e Remaster版の日本語ルールアシスタントです。正確なルール解説を日本語で行ってください。';

			if (provider === 'openai') {
				const res = await fetch('https://api.openai.com/v1/chat/completions', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer ' + apiKey,
					},
					body: JSON.stringify({
						model: 'gpt-4o-mini',
						messages: [
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: msg },
						],
						max_tokens: 1000,
					}),
				});
				const data = await res.json();
				reply =
					data.choices?.[0]?.message?.content || '応答を取得できませんでした。';
			} else if (provider === 'anthropic') {
				const res = await fetch('https://api.anthropic.com/v1/messages', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01',
						'anthropic-dangerous-direct-browser-access': 'true',
					},
					body: JSON.stringify({
						model: 'claude-sonnet-4-20250514',
						max_tokens: 1000,
						system: systemPrompt,
						messages: [{ role: 'user', content: msg }],
					}),
				});
				const data = await res.json();
				reply = data.content?.[0]?.text || '応答を取得できませんでした。';
			} else if (provider === 'google') {
				const res = await fetch(
					`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							contents: [
								{
									parts: [
										{ text: systemPrompt + '\n\nユーザーの質問: ' + msg },
									],
								},
							],
						}),
					},
				);
				const data = await res.json();
				reply =
					data.candidates?.[0]?.content?.parts?.[0]?.text ||
					'応答を取得できませんでした。';
			}
			// 「考え中…」を消す
			const log = document.getElementById('chatLog');
			const last = log.lastElementChild;
			if (last && last.textContent === '考え中…') log.removeChild(last);
			addChat('ai', reply);
		} catch (err) {
			const log = document.getElementById('chatLog');
			const last = log.lastElementChild;
			if (last && last.textContent === '考え中…') log.removeChild(last);
			addChat(
				'sys',
				'エラー: ' + err.message + '\nローカルデータから回答します：',
			);
			localAnswer(msg);
		}
	}

	function localAnswer(query) {
		const q = query.toLowerCase();
		let results = [];

		// 状態異常検索
		DB.conditions.forEach((c) => {
			if (c.name.includes(query) || c.nameEn.toLowerCase().includes(q)) {
				results.push(`【${c.name}（${c.nameEn}）】${c.desc}`);
			}
		});
		// 呪文検索
		DB.spells.forEach((s) => {
			if (s.name.includes(query) || s.nameEn.toLowerCase().includes(q)) {
				results.push(
					`【${s.name}（${s.nameEn}）】ランク${s.rank} [${s.traditions.join('/')}] ${s.desc}`,
				);
			}
		});
		// 特技検索
		DB.feats.forEach((f) => {
			if (f.name.includes(query) || f.nameEn.toLowerCase().includes(q)) {
				results.push(
					`【${f.name}（${f.nameEn}）】Lv${f.level} ${f.cls} - ${f.desc}`,
				);
			}
		});
		// クラス検索
		DB.classes.forEach((c) => {
			if (c.name.includes(query) || c.nameEn.toLowerCase().includes(q)) {
				results.push(
					`【${c.name}（${c.nameEn}）】HP${c.hp} 主能力:${c.keyAbility} - ${c.desc}`,
				);
			}
		});

		if (results.length > 0) {
			addChat('ai', results.slice(0, 5).join('\n\n'));
		} else {
			addChat(
				'ai',
				'該当するデータが見つかりませんでした。キーワードを変えて検索してください。',
			);
		}
	}

	// ════════════════════════════════════
	// キャラクター作成
	// ════════════════════════════════════
	function setupCreator() {
		renderStepIndicator();
		renderStep();
		document.getElementById('btnPrev').addEventListener('click', () => {
			if (ST.step > 0) {
				ST.step--;
				renderStepIndicator();
				renderStep();
			}
		});
		document.getElementById('btnNext').addEventListener('click', () => {
			if (ST.step < STEPS.length - 1) {
				ST.step++;
				renderStepIndicator();
				renderStep();
			}
		});
		document.getElementById('btnExport').addEventListener('click', exportJSON);
		document
			.getElementById('btnGenImage')
			.addEventListener('click', generateImage);
	}

	function renderStepIndicator() {
		const el = document.getElementById('step-nav');
		el.innerHTML = '';
		STEPS.forEach((s, i) => {
			const dot = document.createElement('div');
			dot.className =
				'step-dot' +
				(i === ST.step ? ' active' : '') +
				(i < ST.step ? ' done' : '');
			dot.textContent = s.title;
			dot.addEventListener('click', () => {
				ST.step = i;
				renderStepIndicator();
				renderStep();
			});
			el.appendChild(dot);
		});
		document.getElementById('btnPrev').disabled = ST.step === 0;
		document.getElementById('btnNext').disabled = ST.step === STEPS.length - 1;
	}

	function renderStep() {
		const el = document.getElementById('step-content');
		const s = ST.step;
		if (s === 0) renderNameStep(el);
		else if (s === 1)
			renderCardStep(
				el,
				'祖先',
				DB.ancestries,
				'ancestry',
				(a) => `HP${a.hp} 速度${a.speed}ft ${a.boosts.join('/')}`,
			);
		else if (s === 2) renderHeritageStep(el);
		else if (s === 3)
			renderCardStep(
				el,
				'背景',
				DB.backgrounds,
				'background',
				(b) => `${b.boosts.join('/')} 技能:${b.skill}`,
			);
		else if (s === 4)
			renderCardStep(
				el,
				'クラス',
				DB.classes,
				'cls',
				(c) => `HP${c.hp} 主能力:${c.keyAbility}`,
			);
		else if (s === 5) renderAbilityStep(el);
		else if (s === 6) renderFeatStep(el);
		else if (s === 7) renderSpellStep(el);
		else if (s === 8) renderEquipStep(el);
		else if (s === 9) renderCompleteStep(el);
		updateSheet();
	}

	// --- Step 0: 名前 ---
	function renderNameStep(el) {
		el.innerHTML = `<h3>${STEPS[0].title}</h3>
    <label>キャラクター名: <input type="text" id="charName" value="${ST.char.name}" placeholder="名前を入力"></label>
    <label>レベル: <input type="number" id="charLevel" value="${ST.char.level}" min="1" max="20"></label>`;
		el.querySelector('#charName').addEventListener(
			'input',
			(e) => (ST.char.name = e.target.value),
		);
		el.querySelector('#charLevel').addEventListener(
			'input',
			(e) => (ST.char.level = Math.max(1, Math.min(20, +e.target.value))),
		);
	}

	// --- カード選択汎用 ---
	function renderCardStep(el, title, data, key, subFn) {
		el.innerHTML = `<h3>${STEPS[ST.step].title}</h3><div class="card-grid" id="cardGrid"></div>`;
		const grid = el.querySelector('#cardGrid');
		data.forEach((item) => {
			const card = document.createElement('div');
			card.className =
				'card-item' + (ST.char[key]?.id === item.id ? ' selected' : '');
			card.innerHTML = `<div class="card-title">${item.name}</div>
      <div class="card-sub">${item.nameEn || ''} ${subFn(item)}</div>
      <div class="card-desc">${item.desc || ''}</div>`;
			card.addEventListener('click', () => {
				ST.char[key] = item;
				grid
					.querySelectorAll('.card-item')
					.forEach((c) => c.classList.remove('selected'));
				card.classList.add('selected');
				updateSheet();
			});
			grid.appendChild(card);
		});
	}

	// --- Step 2: 遺産 ---
	function renderHeritageStep(el) {
		const anc = ST.char.ancestry;
		if (!anc) {
			el.innerHTML = '<h3>先に祖先を選択してください</h3>';
			return;
		}
		const filtered = DB.heritages.filter((h) => h.ancestry === anc.id);
		el.innerHTML = `<h3>${STEPS[2].title}（${anc.name}の遺産）</h3><div class="card-grid" id="cardGrid"></div>`;
		const grid = el.querySelector('#cardGrid');
		filtered.forEach((item) => {
			const card = document.createElement('div');
			card.className =
				'card-item' + (ST.char.heritage?.id === item.id ? ' selected' : '');
			card.innerHTML = `<div class="card-title">${item.name}</div><div class="card-desc">${item.desc}</div>`;
			card.addEventListener('click', () => {
				ST.char.heritage = item;
				grid
					.querySelectorAll('.card-item')
					.forEach((c) => c.classList.remove('selected'));
				card.classList.add('selected');
				updateSheet();
			});
			grid.appendChild(card);
		});
	}

	// --- Step 5: 能力値 ---
	function renderAbilityStep(el) {
		const abs = DB.abilities;
		el.innerHTML = `<h3>${STEPS[5].title}</h3><p>各能力値の初期値は10です。ブースト(+2)を割り振ってください。</p><div id="abilityGrid"></div>`;
		const grid = el.querySelector('#abilityGrid');
		abs.forEach((ab) => {
			const row = document.createElement('div');
			row.style.cssText =
				'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem';
			const val = ST.char.abilities[ab.id];
			row.innerHTML = `<span style="width:80px;font-weight:bold;color:var(--accent2)">${ab.name}</span>
      <button data-ab="${ab.id}" data-dir="-1" style="width:30px">-</button>
      <span id="ab_${ab.id}" style="width:30px;text-align:center;font-weight:bold">${val}</span>
      <button data-ab="${ab.id}" data-dir="1" style="width:30px">+</button>
      <span style="font-size:0.8rem;color:var(--fg2)">${ab.desc}</span>`;
			grid.appendChild(row);
		});
		grid.querySelectorAll('button').forEach((btn) => {
			btn.addEventListener('click', () => {
				const id = btn.dataset.ab,
					dir = +btn.dataset.dir;
				let v = ST.char.abilities[id] + dir * 2;
				if (v < 8) v = 8;
				if (v > 18) v = 18;
				ST.char.abilities[id] = v;
				document.getElementById('ab_' + id).textContent = v;
				updateSheet();
			});
		});
	}

	// --- Step 6: 特技 ---
	function renderFeatStep(el) {
		const cls = ST.char.cls;
		el.innerHTML = `<h3>${STEPS[6].title}</h3>
    <div class="filter-bar">
      <label>カテゴリ: <select id="featCatFilter">
        <option value="all">全て</option><option value="クラス">クラス特技</option>
        <option value="一般">一般特技</option><option value="技能">技能特技</option>
      </select></label>
      <label>最大Lv: <input type="number" id="featLvFilter" value="${ST.char.level}" min="1" max="20" style="width:60px"></label>
    </div>
    <div class="check-list" id="featList"></div>`;
		const render = () => {
			const cat = document.getElementById('featCatFilter').value;
			const maxLv = +document.getElementById('featLvFilter').value;
			const list = el.querySelector('#featList');
			list.innerHTML = '';
			DB.feats
				.filter((f) => {
					if (cat !== 'all' && f.category !== cat) return false;
					if (f.level > maxLv) return false;
					if (
						cat === 'クラス' &&
						cls &&
						f.cls !== cls.name &&
						f.cls !== '全クラス'
					)
						return false;
					return true;
				})
				.forEach((f) => {
					const item = document.createElement('label');
					item.className = 'check-item';
					const checked = ST.char.feats.some((x) => x.name === f.name);
					item.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}>
        <div><span class="ci-name">${f.name}</span> <span class="badge badge-level">Lv${f.level}</span>
        <span class="badge badge-cat">${f.category}</span>
        <div class="ci-detail">${f.nameEn} — ${f.desc}</div></div>`;
					item.querySelector('input').addEventListener('change', (e) => {
						if (e.target.checked) ST.char.feats.push(f);
						else ST.char.feats = ST.char.feats.filter((x) => x.name !== f.name);
						updateSheet();
					});
					list.appendChild(item);
				});
		};
		el.querySelector('#featCatFilter').addEventListener('change', render);
		el.querySelector('#featLvFilter').addEventListener('input', render);
		render();
	}

	// --- Step 7: 呪文 ---
	function renderSpellStep(el) {
		const cls = ST.char.cls;
		if (!cls || !cls.spellcasting) {
			el.innerHTML = `<h3>${STEPS[7].title}</h3><p>選択中のクラスは呪文を使用しません。次へ進んでください。</p>`;
			return;
		}
		const maxRank = Math.min(10, Math.ceil(ST.char.level / 2));
		el.innerHTML = `<h3>${STEPS[7].title}（${cls.name}）</h3>
    <div class="filter-bar">
      <label>ランク: <select id="spellRankFilter">
        <option value="-1">全て</option><option value="0">キャントリップ</option>
        ${Array.from({ length: maxRank }, (_, i) => `<option value="${i + 1}">ランク${i + 1}</option>`).join('')}
      </select></label>
      <label>伝統: <select id="spellTradFilter">
        <option value="all">全て</option>
        <option value="秘術">秘術</option><option value="神術">神術</option>
        <option value="原始">原始</option><option value="オカルト">オカルト</option>
      </select></label>
    </div>
    <div class="check-list" id="spellList"></div>`;
		const render = () => {
			const rank = +document.getElementById('spellRankFilter').value;
			const trad = document.getElementById('spellTradFilter').value;
			const list = el.querySelector('#spellList');
			list.innerHTML = '';
			DB.spells
				.filter((s) => {
					if (rank !== -1 && s.rank !== rank) return false;
					if (trad !== 'all' && !s.traditions.includes(trad)) return false;
					return true;
				})
				.forEach((s) => {
					const item = document.createElement('label');
					item.className = 'check-item';
					const checked = ST.char.spells.some((x) => x.name === s.name);
					item.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}>
        <div><span class="ci-name">${s.name}</span>
        <span class="badge badge-rank">R${s.rank}</span>
        ${s.traditions.map((t) => `<span class="badge badge-tradition">${t}</span>`).join('')}
        <div class="ci-detail">${s.nameEn} — ${s.desc}</div></div>`;
					item.querySelector('input').addEventListener('change', (e) => {
						if (e.target.checked) ST.char.spells.push(s);
						else
							ST.char.spells = ST.char.spells.filter((x) => x.name !== s.name);
						updateSheet();
					});
					list.appendChild(item);
				});
		};
		el.querySelector('#spellRankFilter').addEventListener('change', render);
		el.querySelector('#spellTradFilter').addEventListener('change', render);
		render();
	}

	// --- Step 8: 装備 ---
	function renderEquipStep(el) {
		el.innerHTML = `<h3>${STEPS[8].title}</h3>
    <div class="filter-bar">
      <label>カテゴリ: <select id="equipCatFilter">
        <option value="all">全て</option><option value="weapons">武器</option>
        <option value="armor">防具</option><option value="gear">冒険道具</option>
        <option value="magic">マジックアイテム</option>
      </select></label>
    </div>
    <div class="check-list" id="equipList"></div>`;
		const render = () => {
			const cat = document.getElementById('equipCatFilter').value;
			const list = el.querySelector('#equipList');
			list.innerHTML = '';
			let items = [];
			if (cat === 'all' || cat === 'weapons')
				items = items.concat(DB.weapons.map((w) => ({ ...w, _cat: '武器' })));
			if (cat === 'all' || cat === 'armor')
				items = items.concat(DB.armor.map((a) => ({ ...a, _cat: '防具' })));
			if (cat === 'all' || cat === 'gear')
				items = items.concat(
					DB.adventuringGear.map((g) => ({ ...g, _cat: '道具' })),
				);
			if (cat === 'all' || cat === 'magic')
				items = items.concat(
					DB.magicItems.map((m) => ({ ...m, _cat: '魔法' })),
				);
			items.forEach((item) => {
				const label = document.createElement('label');
				label.className = 'check-item';
				const checked = ST.char.equipment.some((x) => x.name === item.name);
				label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''}>
        <div><span class="ci-name">${item.name}</span>
        <span class="badge badge-cat">${item._cat}</span>
        ${item.price ? `<span style="color:var(--accent2);font-size:0.8rem">${item.price}</span>` : ''}
        ${item.level ? `<span class="badge badge-level">Lv${item.level}</span>` : ''}
        <div class="ci-detail">${item.nameEn || ''} — ${item.damage || ''} ${item.desc || ''}</div></div>`;
				label.querySelector('input').addEventListener('change', (e) => {
					if (e.target.checked) ST.char.equipment.push(item);
					else
						ST.char.equipment = ST.char.equipment.filter(
							(x) => x.name !== item.name,
						);
					updateSheet();
				});
				list.appendChild(label);
			});
		};
		el.querySelector('#equipCatFilter').addEventListener('change', render);
		render();
	}

	// --- Step 9: 完成 ---
	function renderCompleteStep(el) {
		el.innerHTML = `<h3>🎉 キャラクター完成！</h3>
    <p>キャラクターシートを確認し、JSONエクスポートまたは画像生成をご利用ください。</p>
    <p>全てのデータはブラウザ内で完結しています。</p>`;
	}

	// --- シートプレビュー ---
	function updateSheet() {
		const c = ST.char;
		const mod = (v) => Math.floor((v - 10) / 2);
		const fmtMod = (v) => {
			const m = mod(v);
			return m >= 0 ? '+' + m : '' + m;
		};

		// HP計算
		const ancHp = c.ancestry?.hp || 0;
		const clsHp = c.cls?.hp || 0;
		const conMod = mod(c.abilities.con);
		c.hp = ancHp + (clsHp + conMod) * c.level;

		// AC計算（簡易）
		const dexMod = mod(c.abilities.dex);
		c.ac = 10 + dexMod + c.level;

		// Speed
		c.speed = c.ancestry?.speed || 25;

		const el = document.getElementById('char-sheet');
		el.innerHTML = `
    <div class="sh-section"><span class="sh-label">名前</span> <span class="sh-value">${c.name || '未入力'}</span> Lv${c.level}</div>
    <div class="sh-section"><span class="sh-label">祖先</span> <span class="sh-value">${c.ancestry?.name || '未選択'}</span> ${c.heritage ? `/ ${c.heritage.name}` : ''}</div>
    <div class="sh-section"><span class="sh-label">背景</span> <span class="sh-value">${c.background?.name || '未選択'}</span></div>
    <div class="sh-section"><span class="sh-label">クラス</span> <span class="sh-value">${c.cls?.name || '未選択'}</span></div>
    <div class="sh-section"><span class="sh-label">HP</span> <span class="sh-value">${c.hp}</span> | <span class="sh-label">AC</span> <span class="sh-value">${c.ac}</span> | <span class="sh-label">速度</span> <span class="sh-value">${c.speed}ft</span></div>
    <div class="sh-section"><span class="sh-label">能力値</span><br>
      ${DB.abilities.map((a) => `<span style="margin-right:0.5rem"><b>${a.abbr}</b> ${c.abilities[a.id]}(${fmtMod(c.abilities[a.id])})</span>`).join('')}
    </div>
    ${c.feats.length ? `<div class="sh-section"><span class="sh-label">特技(${c.feats.length})</span><div class="sh-list">${c.feats.map((f) => f.name).join(', ')}</div></div>` : ''}
    ${c.spells.length ? `<div class="sh-section"><span class="sh-label">呪文(${c.spells.length})</span><div class="sh-list">${c.spells.map((s) => `${s.name}(R${s.rank})`).join(', ')}</div></div>` : ''}
    ${c.equipment.length ? `<div class="sh-section"><span class="sh-label">装備(${c.equipment.length})</span><div class="sh-list">${c.equipment.map((e) => e.name).join(', ')}</div></div>` : ''}
  `;
	}

	function exportJSON() {
		const blob = new Blob([JSON.stringify(ST.char, null, 2)], {
			type: 'application/json',
		});
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = (ST.char.name || 'character') + '.json';
		a.click();
	}

	async function generateImage() {
		const c = ST.char;
		const prompt = `Fantasy character portrait: ${c.ancestry?.nameEn || 'Human'} ${c.cls?.nameEn || 'Adventurer'}, ${c.heritage?.name || ''}, heroic pose, detailed armor and weapons, Pathfinder RPG style, digital art, dramatic lighting`;

		// ステップエリアに結果を表示
		const stepEl = document.getElementById('step-content');
		if (!stepEl) return;

		stepEl.innerHTML = `<h3>🎨 キャラクター画像生成</h3><div id="imgResult"><p class="loading">初期化中…</p></div>`;
		const resultEl = document.getElementById('imgResult');

		try {
			// Puter.jsをロード（未ロードの場合）
			if (typeof puter === 'undefined') {
				resultEl.innerHTML =
					'<p class="loading">Puter.jsを読み込んでいます…</p>';
				await new Promise((resolve, reject) => {
					const script = document.createElement('script');
					script.src = 'https://js.puter.com/v2/';
					script.onload = resolve;
					script.onerror = () =>
						reject(new Error('Puter.jsの読み込みに失敗しました'));
					document.head.appendChild(script);
				});
				// Puterの初期化を待つ
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			resultEl.innerHTML = '<p class="loading">画像を生成中…</p>';
			const response = await puter.ai.txt2img(prompt);
			const img = document.createElement('img');
			img.src = response.src || URL.createObjectURL(response);
			img.style.maxWidth = '100%';
			img.style.borderRadius = '8px';
			resultEl.innerHTML = '';
			resultEl.appendChild(img);
		} catch (err) {
			resultEl.innerHTML = `<p style="color:#f08080">画像生成に失敗しました: ${err.message}</p><p style="font-size:0.8rem;color:#888">Puter.jsにサインインしてください。初回のみアカウント作成が必要です。</p>`;
		}
	}

	// ════════════════════════════════════
	// クイックリファレンス
	// ════════════════════════════════════
	function setupRef() {
		const searchInput = document.getElementById('refSearch');
		if (searchInput) {
			searchInput.addEventListener('input', (e) => {
				renderRefResults(e.target.value);
			});
		}
		renderRefResults('');
	}

	function renderRefResults(search = '') {
		const el = document.getElementById('ref-content');
		el.innerHTML = '';
		const q = search.toLowerCase();
		let items = [];

		// 全カテゴリを統合
		items = [
			...DB.conditions.map((c) => ({
				name: c.name,
				meta: `状態異常: ${c.nameEn}`,
				desc: c.desc,
			})),
			...DB.actions.map((a) => ({
				name: a.name,
				meta: `アクション: ${a.nameEn} [${a.actions}アクション]`,
				desc: a.desc,
			})),
			...DB.skills.map((s) => ({
				name: s.name,
				meta: `技能: ${s.nameEn} (${s.ability})`,
				desc: s.desc,
			})),
			...DB.spells.map((s) => ({
				name: s.name,
				meta: `呪文: ${s.nameEn} R${s.rank} [${s.traditions.join('/')}]`,
				desc: s.desc,
			})),
			...DB.feats.map((f) => ({
				name: f.name,
				meta: `特技: ${f.nameEn} Lv${f.level} ${f.category} ${f.cls || ''}`,
				desc: f.desc,
			})),
			...DB.weapons.map((w) => ({
				name: w.name,
				meta: `武器: ${w.nameEn} ${w.damage} ${w.price}`,
				desc: w.desc,
			})),
			...DB.armor.map((a) => ({
				name: a.name,
				meta: `防具: ${a.nameEn} AC+${a.ac} ${a.price}`,
				desc: a.desc,
			})),
			...DB.magicItems.map((m) => ({
				name: m.name,
				meta: `魔法のアイテム: ${m.nameEn} Lv${m.level || '?'} ${m.price || ''}`,
				desc: m.desc,
			})),
			...DB.adventuringGear.map((g) => ({
				name: g.name,
				meta: `冒険用具: ${g.nameEn} ${g.price}`,
				desc: g.desc,
			})),
		];

		if (q) {
			items = items.filter(
				(i) =>
					i.name.toLowerCase().includes(q) ||
					i.meta.toLowerCase().includes(q) ||
					i.desc.toLowerCase().includes(q),
			);
		}

		items.slice(0, 100).forEach((item) => {
			const card = document.createElement('div');
			card.className = 'ref-card';
			card.innerHTML = `<div class="rc-name">${item.name}</div><div class="rc-meta">${item.meta}</div><div class="rc-desc">${item.desc}</div>`;
			el.appendChild(card);
		});

		if (items.length === 0) {
			el.innerHTML = '<div class="loading">該当するデータがありません。</div>';
		}
	}

	// ════════════════════════════════════
	// 設定
	// ════════════════════════════════════
	function setupSettings() {
		// 復元
		const saved = localStorage.getItem('pf2e_ai_provider');
		if (saved) {
			const el = document.getElementById('ai-provider');
			if (el) el.value = saved;
		}
		const savedKey = localStorage.getItem('pf2e_ai_key');
		if (savedKey) {
			const el = document.getElementById('api-key');
			if (el) el.value = savedKey;
		}

		const btnSave = document.getElementById('btnSaveSettings');
		if (btnSave) {
			btnSave.addEventListener('click', () => {
				const providerEl = document.getElementById('ai-provider');
				const keyEl = document.getElementById('api-key');
				if (providerEl) {
					localStorage.setItem('pf2e_ai_provider', providerEl.value);
				}
				if (keyEl) {
					localStorage.setItem('pf2e_ai_key', keyEl.value);
				}
				const statusEl = document.getElementById('settingsStatus');
				if (statusEl) {
					statusEl.textContent = '✓ 保存しました';
					setTimeout(() => (statusEl.textContent = ''), 3000);
				}
			});
		}

		const btnToggle = document.getElementById('btnToggleKey');
		if (btnToggle) {
			btnToggle.addEventListener('click', () => {
				const keyEl = document.getElementById('api-key');
				if (keyEl) {
					if (keyEl.type === 'password') {
						keyEl.type = 'text';
						btnToggle.textContent = '隠す';
					} else {
						keyEl.type = 'password';
						btnToggle.textContent = '表示';
					}
				}
			});
		}
	}
})();
