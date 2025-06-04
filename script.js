let db;
const DB_NAME = "PrizeBondDB";
const DB_VERSION = 1;
const BOND_STORE = "bonds";
const RESULT_STORE = "results";

window.addEventListener("DOMContentLoaded", () => {
  initDB().then(() => {
    attachEvents();
    showPage("home");
    refreshUI();
  });
});

// DB Open and upgrade
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject("ডেটাবেজ খুলতে সমস্যা");
    request.onblocked = () => alert("অন্যান্য ট্যাব ডেটাবেজ ব্যাবহার করছে।");

    request.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains(BOND_STORE)) {
        db.createObjectStore(BOND_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(RESULT_STORE)) {
        db.createObjectStore(RESULT_STORE, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };
  });
}

// Attach all event listeners once
function attachEvents() {
  document.getElementById("menuBtn").onclick = () => {
    document.getElementById("sidebar").classList.toggle("show");
  };

  document.body.onclick = (e) => {
    const sidebar = document.getElementById("sidebar");
    const menuBtn = document.getElementById("menuBtn");
    if (
      sidebar.classList.contains("show") &&
      !sidebar.contains(e.target) &&
      e.target !== menuBtn
    ) {
      sidebar.classList.remove("show");
    }

    const sortOverlay = document.getElementById("sortOverlay");
    if (
      !sortOverlay.classList.contains("hidden") &&
      !e.target.closest(".sortMenu") &&
      e.target.id !== "sortBtn"
    ) {
      sortOverlay.classList.add("hidden");
    }
  };

  document.getElementById("sortBtn").onclick = () => {
    document.getElementById("sortOverlay").classList.remove("hidden");
  };

  // Nav links
  document.querySelectorAll("nav#sidebar li").forEach((li) => {
    li.onclick = () => {
      showPage(li.getAttribute("onclick").match(/'(\w+)'/)[1]);
    };
  });

  // Buttons
  document.querySelector("#insertBond button").onclick = addBond;
  document.querySelector("#insertResult button").onclick = addResult;
  document.querySelector("#home button[onclick='searchBond()']").onclick = searchBond;
  document.querySelector("#home button[onclick='checkMatches()']").onclick = checkMatches;

  // Sort menu items
  document.querySelectorAll(".sortMenu li").forEach((li) => {
    li.onclick = () => {
      sortBondList(li.textContent.includes("⬆️") ? "asc" :
                   li.textContent.includes("⬇️") ? "desc" :
                   li.textContent.includes("🆕") ? "newest" :
                   li.textContent.includes("🕒") ? "oldest" : "default");
    };
  });
}

let currentSort = "default";

function showPage(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document.getElementById(page).classList.remove("hidden");
  document.getElementById("sidebar").classList.remove("show");
  refreshUI();
}

function refreshUI() {
  loadAll(BOND_STORE).then((bonds) => {
    // Sorting
    if (currentSort === "asc") bonds.sort((a, b) => a.number.localeCompare(b.number));
    else if (currentSort === "desc") bonds.sort((a, b) => b.number.localeCompare(a.number));
    else if (currentSort === "newest") bonds.reverse();

    // Home page bond list
    const bondListHome = document.getElementById("bondListHome");
    bondListHome.innerHTML = "";
    bonds.forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b.number;
      bondListHome.appendChild(li);
    });

    // Insert bond page list with delete buttons
    const bondListInsert = document.getElementById("bondList");
    bondListInsert.innerHTML = "";
    bonds.forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b.number + " ";
      const btn = document.createElement("button");
      btn.textContent = "❌";
      btn.title = "মুছুন";
      btn.onclick = () => deleteItem(BOND_STORE, b.id).then(refreshUI);
      li.appendChild(btn);
      bondListInsert.appendChild(li);
    });
  });

  loadAll(RESULT_STORE).then((results) => {
    const resultList = document.getElementById("resultList");
    resultList.innerHTML = "";
    results.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r.number + " ";
      const btn = document.createElement("button");
      btn.textContent = "❌";
      btn.title = "মুছুন";
      btn.onclick = () => deleteItem(RESULT_STORE, r.id).then(refreshUI);
      li.appendChild(btn);
      resultList.appendChild(li);
    });
  });

  // Clear search results & inputs on page change
  document.getElementById("searchResult").textContent = "";
  document.getElementById("resultBox").textContent = "";
  document.getElementById("searchInput").value = "";
  document.getElementById("bondInput").value = "";
  document.getElementById("resultInput").value = "";
}

function addBond() {
  const val = document.getElementById("bondInput").value.trim();
  if (!/^\d{7}$/.test(val)) {
    alert("৭ ডিজিটের বন্ড নাম্বার দিন");
    return;
  }
  checkDuplicate(BOND_STORE, val).then((exists) => {
    if (exists) {
      alert("এই বন্ড নাম্বারটি আগে থেকেই আছে");
    } else {
      addItem(BOND_STORE, { number: val }).then(() => {
        alert("বন্ড যোগ করা হয়েছে");
        refreshUI();
        document.getElementById("bondInput").value = "";
      });
    }
  });
}

function addResult() {
  const val = document.getElementById("resultInput").value.trim();
  if (!/^\d{7}$/.test(val)) {
    alert("৭ ডিজিটের ফলাফল নাম্বার দিন");
    return;
  }
  checkDuplicate(RESULT_STORE, val).then((exists) => {
    if (exists) {
      alert("এই ফলাফল নাম্বারটি আগে থেকেই আছে");
    } else {
      addItem(RESULT_STORE, { number: val }).then(() => {
        alert("ফলাফল যোগ করা হয়েছে");
        refreshUI();
        document.getElementById("resultInput").value = "";
      });
    }
  });
}

function searchBond() {
  const val = document.getElementById("searchInput").value.trim();
  if (!val) {
    alert("সার্চ করার জন্য বন্ড নাম্বার দিন");
    return;
  }
  loadAll(BOND_STORE).then((bonds) => {
    const found = bonds.some((b) => b.number === val);
    document.getElementById("searchResult").textContent = found
      ? `✅ ${val} আপনার বন্ড তালিকায় আছে।`
      : `❌ ${val} পাওয়া যায়নি।`;
  });
}

function checkMatches() {
  Promise.all([loadAll(BOND_STORE), loadAll(RESULT_STORE)]).then(
    ([bonds, results]) => {
      const bondNums = bonds.map((b) => b.number);
      const resultNums = new Set(results.map((r) => r.number));
      const matched = bondNums.filter((num) => resultNums.has(num));
      const box = document.getElementById("resultBox");
      if (matched.length > 0) {
        box.textContent = `🎉 মিল পাওয়া গেছে: ${matched.join(", ")}`;
      } else {
        box.textContent = "❌ কোনো মিল পাওয়া যায়নি।";
      }
    }
  );
}

function sortBondList(type) {
  currentSort = type;
  document.getElementById("sortOverlay").classList.add("hidden");
  refreshUI();
}

// IndexedDB utility functions
function addItem(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject();
  });
}

function loadAll(storeName) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve([]);
  });
}

function deleteItem(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject();
  });
}

function checkDuplicate(storeName, number) {
  return loadAll(storeName).then((items) =>
    items.some((item) => item.number === number)
  );
}

// 🔔 OPTIONAL: Warn if in desktop mode on mobile
if (screen.width < 768 && window.innerWidth > 768) {
  document.body.classList.add("desktop-mode-on-mobile");
}