// == 엔트리 - 팔취 알림 content.js ==
console.log("🚀 엔트리 - 팔취 알림 로드");

// ───── 유틸 ─────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel, root = document) => root.querySelector(sel);
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

// ───── 전용 포털(React 리렌더 영향 제거용) ─────
let _popupHost = null;
function getPopupHost() {
  if (_popupHost && document.body.contains(_popupHost)) return _popupHost;
  const portal = document.createElement("div");
  portal.id = "entry-unfollow-portal";
  document.body.appendChild(portal); // #__next 바깥
  _popupHost = portal;
  return _popupHost;
}

// ───── 스타일 주입 (팝업 상단 중앙, 스크롤/높이 제한 해제) ─────
function injectPopupStylesFromSpec() {
  const EXISTING = document.getElementById("entry-unfollow-style");
  if (EXISTING) EXISTING.remove();
  const css = `
#entry-unfollow-portal { }
#popupStyle, #popupStyle * { box-sizing: border-box; }
.css-d9xsgv {
  position: absolute !important;
  left: 50% !important;
  top: 80px !important;
  transform: translateX(-50%) !important;
  z-index: 120 !important;
  width: 386px !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}
.css-d9xsgv > div { scrollbar-width: none; }
.css-1548ohy {
  position: relative;
  border-radius: 20px;
  border: 1px solid rgb(228,236,240);
  background-color: #fff;
  box-shadow: rgba(0,0,0,.06) 0 1px 1px 0;
  max-height: none !important;
  overflow: visible !important;
}
.css-maiyd8 {
  display: block !important;
  border-radius: inherit;
  overflow: visible !important;
  max-height: none !important;
  min-height: 0 !important;
}
.css-18rbqj2 { display:block; padding:45px 27px 14px; font-size:24px; font-weight:600; color:#000; line-height:24px; }
.css-18rbqj2 em { color: rgb(22,216,163); }
em, address, i { font-style: normal; }
.css-umwchj { display:block !important; overflow:visible !important; max-height:none !important; height:auto !important; }
.css-umwchj ul { display:block !important; max-height:none !important; overflow:visible !important; }
body, p, h1, h2, h3, h4, h5, h6, ul, ol, li, dl, dt, dd, table, th, td, form, fieldset, legend, input, textarea, button, select {
  margin:0; padding:0; text-size-adjust:none;
  color: rgb(44,49,61);
  font-family: NanumSquareWebFont, 나눔고딕, NanumGothic, -apple-system, "맑은 고딕", "Malgun Gothic", 돋움, dotum, Helvetica, arial, sans-serif;
}
ul, ol { list-style: none; }
.css-1fo085z { padding:13px 27px; cursor:pointer; display:flex; align-items:center; gap:12px; }
a, a:hover, a:active, a:focus { text-decoration: none; }
.css-1fo085z a { display:inline-flex; max-width:100%; align-items:center; }
.css-7abnxa { overflow:hidden; position:relative; width:34px; height:34px; margin-right:12px; border-radius:50%; background-color:#222; flex:0 0 34px; }
img, fieldset, button { border:0; }
img, fieldset, button, video, iframe { vertical-align:top; }
.css-7abnxa img { width:100%; height:100%; object-fit:cover; image-rendering:pixelated; }
.css-xal00d { display:block; overflow:hidden; font-weight:600; font-size:16px; color: rgb(44,49,61); line-height:18px; text-overflow:ellipsis; white-space:nowrap; }
.css-l9bvqd { display:block; padding:14px 0 12px; font-size:14px; color: rgb(151,151,151); line-height:14px; text-align:center; }
[role="button"] { cursor: pointer; }
.css-16whppa { position:absolute; top:18px; right:18px; z-index:20; width:18px; height:18px; background:url("/img/IcoPopupClose3.svg") 0 0 / 18px no-repeat; transition: transform .3s; }
.entry-actions { display:flex; justify-content:flex-end; gap:8px; padding:0 16px 20px 16px; }
.entry-clearall {
  padding: 8px 12px;
  background: #f4f6f8;
  border: 1px solid #e4ecf0;
  border-radius: 8px;
  color: #2c313d;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.entry-clearall:hover { background:#eef2f5; }
`.trim();
  const style = document.createElement("style");
  style.id = "entry-unfollow-style";
  style.textContent = css;
  document.head.appendChild(style);
}

// ───── 로그인 유저 ID (Next.js data) ─────
const NEXT_DATA_URL = "https://playentry.org/_next/data/98pbpJZQtThZvJJ0Sjn20/ko.json";
let _cachedUserId = null;
async function getLoggedInUserId() {
  if (_cachedUserId) return _cachedUserId;
  try {
    const res = await fetch(NEXT_DATA_URL, { method: "GET", credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json();
    const userId = json?.pageProps?.initialState?.common?.user?._id || null;
    _cachedUserId = userId;
    return userId;
  } catch {
    return null;
  }
}

// ───── CSRF 토큰 ─────
async function waitForCsrfToken(timeoutMs = 5000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const t = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    if (t && t.trim()) return t;
    // await sleep(50);
  }
  return "";
}

// ───── GraphQL: SELECT_FOLLOWERS ─────
const GQL_URL = "https://playentry.org/graphql/SELECT_FOLLOWERS";
const GQL_QUERY = `
  query SELECT_FOLLOWERS($user: String,$query: String,$pageParam: PageParam,$searchAfter: JSON){
    followers(user: $user,query:$query,pageParam:$pageParam,searchAfter:$searchAfter){
      searchAfter
      searchTotal
      list{
        id
        user{
          id
          nickname
          profileImage{filename imageType}
        }
      }
    }
  }
`;

// ───── 전체 팔로워 수집: 서버 searchAfter만 신뢰 ─────
async function fetchAllFollowers(userId) {
  const pageSize = 50;
  const all = [];
  const seen = new Set();
  const csrfToken = await waitForCsrfToken(5000);
  if (!csrfToken) return [];

  let cursor = undefined;
  let guard = 0;

  while (guard++ < 400) {
    const body = {
      query: GQL_QUERY,
      variables: {
        user: userId,
        pageParam: { display: pageSize },
        ...(cursor ? { searchAfter: cursor } : {}),
      },
    };

    const res = await fetch(GQL_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "csrf-token": csrfToken },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("GraphQL 요청 실패: " + res.status);

    const json = await res.json();
    const chunk = json?.data?.followers?.list || [];
    const nextCursor = json?.data?.followers?.searchAfter || null;

    for (const item of chunk) {
      const uid = item?.user?.id;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      all.push(item);
    }

    if (!nextCursor) break;
    if (nextCursor === cursor) break;
    cursor = nextCursor;

    // await sleep(60);
  }

  return all;
}

// ───── IndexedDB (팔로워 스냅샷) ─────
const DB_NAME = "entry-unfollow-db";
const DB_VER = 1;
const STORE = "followers";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function readAllFollowersFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const os = tx.objectStore(STORE);
    const req = os.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function replaceAllFollowersInDB(records) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const clear = os.clear();
    clear.onsuccess = () => {
      if (records.length === 0) return resolve();
      let pending = records.length;
      records.forEach((r) => {
        const putReq = os.put(r);
        putReq.onsuccess = () => { if (--pending === 0) resolve(); };
        putReq.onerror = () => reject(putReq.error);
      });
    };
    clear.onerror = () => reject(clear.error);
  });
}
async function clearAllFollowersInDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const req = os.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ───── 미확인(UNSEEN) 팔취 큐 (localStorage로 영구 저장) ─────
const UNSEEN_KEY = "entry-unseen-removed-v1";
function getUnseenRemoved() {
  try { return JSON.parse(localStorage.getItem(UNSEEN_KEY) || "[]"); }
  catch { return []; }
}
function setUnseenRemoved(arr) {
  try { localStorage.setItem(UNSEEN_KEY, JSON.stringify(arr)); } catch {}
}
function addUnseenRemoved(newUsers) {
  const unseen = getUnseenRemoved();
  const byId = new Map(unseen.map(u => [u.id, u]));
  for (const u of newUsers) {
    if (u?.id && !byId.has(u.id)) byId.set(u.id, u); // 중복 방지
  }
  setUnseenRemoved([...byId.values()]);
}
function clearUnseenRemoved() { setUnseenRemoved([]); }

// ───── 이미지 URL ─────
function buildProfileImageUrl(profileImage) {
  if (!profileImage || !profileImage.filename || !profileImage.imageType) return "";
  const fn = profileImage.filename;
  const seg1 = fn.slice(0, 2);
  const seg2 = fn.slice(2, 4);
  return `https://playentry.org/uploads/${seg1}/${seg2}/${fn}.${profileImage.imageType}`;
}

// ───── 팝업 렌더링 ─────
function renderPopup(removedUsers = []) {
  $("#popupStyle")?.remove();
  const count = removedUsers.length;

  const itemsHTML = removedUsers.map((u) => {
    const img = buildProfileImageUrl(u.profileImage);
    const imgTag = img ? `<img src="${img}" alt="">` : `<img alt="">`;
    return `
      <li class="css-1fo085z e168xw7x4">
        <a href="https://playentry.org/profile/${u.id}">
          <span class="css-7abnxa e168xw7x3">${imgTag}</span>
          <strong class="css-xal00d e168xw7x2">${escapeHtml(u.nickname || "")}</strong>
        </a>
      </li>`;
  }).join("");

  const html = `
<div width="386" id="popupStyle" class="css-d9xsgv e17epaj40">
  <div class="css-1548ohy e168xw7x8">
    <div class="css-maiyd8 e168xw7x7">
      <strong class="css-18rbqj2 e168xw7x6">팔취 유저<em>${count}</em></strong>
      <div class="css-umwchj e168xw7x5">
        <ul>${itemsHTML}</ul>
        <em class="css-l9bvqd e168xw7x1">가끔씩 정확하지 않은 경우가 있습니다.</em>
      </div>
      <div class="entry-actions">
        <button type="button" class="entry-clearall">모두 삭제</button>
      </div>
    </div>
    <a role="button" class="css-16whppa e168xw7x0"><span class="blind">닫기</span></a>
  </div>
</div>`;
  getPopupHost().insertAdjacentHTML("beforeend", html);

  document.querySelector(".css-16whppa.e168xw7x0")?.addEventListener("click", () => {
    $("#popupStyle")?.remove();
  }, { once: true });

  document.querySelector(".entry-clearall")?.addEventListener("click", async () => {
    try {
      clearUnseenRemoved();                // 확인 처리(비우기)
      _removedSnapshot = getUnseenRemoved();
      renderIntoExistingPopup(_removedSnapshot);
      console.log("[UNSEEN] 모두 삭제(확인) 완료");
    } catch (e) {
      console.warn("unseen clear 실패:", e);
    }
  });
}

function renderIntoExistingPopup(removedUsers = []) {
  const popup = $("#popupStyle");
  if (!popup) return renderPopup(removedUsers);
  const em = popup.querySelector(".css-18rbqj2.e168xw7x6 em");
  if (em) em.textContent = removedUsers.length;
  const ul = popup.querySelector("ul");
  if (ul) {
    ul.innerHTML = removedUsers.map((u) => {
      const img = buildProfileImageUrl(u.profileImage);
      const imgTag = img ? `<img src="${img}" alt="">` : `<img alt="">`;
      return `
        <li class="css-1fo085z e168xw7x4">
          <a href="https://playentry.org/profile/${u.id}">
            <span class="css-7abnxa e168xw7x3">${imgTag}</span>
            <strong class="css-xal00d e168xw7x2">${escapeHtml(u.nickname || "")}</strong>
          </a>
        </li>`;
    }).join("");
  }
}

// ───── 탭 추가 (두 번째 .css-d3v9zr에 삽입, 클릭 시 팝업 표시) ─────
async function ensureTabAndHandler(getRemovedSnapshot) {
  let tabBar = document.querySelectorAll(".css-d3v9zr")[1];
  if (!tabBar) tabBar = document.querySelectorAll(".css-d3v9zr")[1];
  if (!tabBar) { console.log("❌tabBar없음"); return; }

  injectPopupStylesFromSpec(); // 한 번만

  if (tabBar.querySelectorAll("li.css-17mvc82.e13256ik0")[2]) return;

  const li = document.createElement("li");
  li.setAttribute("role", "tab");
  li.className = "css-17mvc82 e13256ik0";

  const a = document.createElement("a");
  a.textContent = "팔취 유저";
  a.href = "javascript:void(0)";
  a.addEventListener("click", (e) => {
    e.preventDefault();
    const removed = Array.isArray(getRemovedSnapshot()) ? getRemovedSnapshot() : [];
    renderPopup(removed); // 0명이어도 항상 팝업 표시
  });

  li.appendChild(a);
  tabBar.appendChild(li);
}

// ───── 메인 로직 (발견 → unseen 큐 누적, 재팔로우 시 unseen에서 제거) ─────
let _removedSnapshot = [];
let _initialized = false;

async function computeRemovedOncePerLoad() {
  if (_initialized) return;
  _initialized = true;

  const userId = await getLoggedInUserId();
  if (!userId) { _removedSnapshot = getUnseenRemoved(); return; }

  try {
    const prev = await readAllFollowersFromDB();

    // 현재 전체 팔로워 스냅샷
    const allFollowers = await fetchAllFollowers(userId);
    const nowCompact = allFollowers.map((item) => {
      const u = item.user || {};
      return { id: u.id, nickname: u.nickname || "", profileImage: u.profileImage || null };
    });

    // ✅ 재팔로우 정리: 현재 nowSet에 존재하는 아이디는 unseen 큐에서 제거
    const nowSet = new Set(nowCompact.map((n) => n.id).filter(Boolean));
    const unseenBefore = getUnseenRemoved();
    const unseenAfter  = unseenBefore.filter(u => !nowSet.has(u.id));
    if (unseenAfter.length !== unseenBefore.length) {
      setUnseenRemoved(unseenAfter);
    }

    // 첫 실행(또는 DB 비었을 때): 비교 없이 저장만
    if (!prev || prev.length === 0) {
      await replaceAllFollowersInDB(nowCompact);
      _removedSnapshot = getUnseenRemoved();
      return;
    }

    // 확정: prev에는 있고 now에는 없는 id = 팔취
    const prevIds = prev.map((p) => p.id).filter(Boolean);
    const removedIds = prevIds.filter((id) => !nowSet.has(id));
    const removedUsers = prev.filter((p) => removedIds.includes(p.id));

    // 🔵 팔취 발견분을 "미확인 큐"에 누적 저장
    if (removedUsers.length) addUnseenRemoved(removedUsers);

    // 스냅샷은 최신으로 갱신
    await replaceAllFollowersInDB(nowCompact);

    // 화면 표시용 스냅샷 = 최신 unseen 큐
    _removedSnapshot = getUnseenRemoved();
    console.log(`[감지] 이번 로드 팔취 ${removedUsers.length}명, 누적 미확인 ${_removedSnapshot.length}명`);
  } catch (e) {
    console.warn("computeRemovedOncePerLoad 실패:", e);
    _removedSnapshot = getUnseenRemoved(); // 실패해도 기존 미확인 유지
  }
}

// 실행
ensureTabAndHandler(() => _removedSnapshot);
window.addEventListener("load", async () => {
  await computeRemovedOncePerLoad();
  // 자동 팝업을 원하면 아래 주석 해제
  // if (!document.getElementById('popupStyle')) renderPopup(_removedSnapshot);
}, { once: true });
