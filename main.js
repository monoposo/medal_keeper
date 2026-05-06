import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
console.log("Firebase app initialized:", app);
const auth = getAuth(app);
console.log("Auth initialized:", auth);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
console.log("Firestore initialized:", db);

const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const userPanel = document.getElementById("userPanel");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const statusMessage = document.getElementById("statusMessage");
const formPanel = document.getElementById("formPanel");
const formModal = document.getElementById("formModal");
const formTitle = document.getElementById("formTitle");
const formModalTitle = document.getElementById("formModalTitle");
const toggleFormButton = document.getElementById("toggleFormButton");
const medalForm = document.getElementById("medalForm");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");
const extensionDaysInput = document.getElementById("extensionDays");
const expireDateInput = document.getElementById("expireDate");
const memoInput = document.getElementById("memo");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const medalList = document.getElementById("medalList");
const emptyState = document.getElementById("emptyState");

// モーダル要素
const confirmModal = document.getElementById("confirmModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");

let currentUser = null;
let medalsUnsubscribe = null;
let editingId = null;

// モーダル関連
let modalResolve = null;

function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    confirmModal.classList.remove("hidden");
    modalResolve = resolve;

    const handleConfirm = () => {
      hideConfirmModal();
      resolve(true);
    };

    const handleCancel = () => {
      hideConfirmModal();
      resolve(false);
    };

    modalConfirm.addEventListener("click", handleConfirm, { once: true });
    modalCancel.addEventListener("click", handleCancel, { once: true });
  });
}

function hideConfirmModal() {
  confirmModal.classList.add("hidden");
}

function setDateDefault() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  expireDateInput.value = `${yyyy}-${mm}-${dd}`;
}

function setLoadingState(isLoggedIn) {
  userPanel.classList.toggle("hidden", !isLoggedIn);
  logoutButton.classList.toggle("hidden", !isLoggedIn);
  loginButton.classList.toggle("hidden", isLoggedIn);
  submitButton.disabled = !isLoggedIn;
  [...medalForm.elements].forEach((element) => {
    if (element.tagName === "BUTTON") return;
    element.disabled = !isLoggedIn;
  });
  if (isLoggedIn) {
    statusMessage.textContent = "ログイン済みです。";
    emptyState.textContent = "読み込み中...";
  } else {
    statusMessage.textContent = "Googleログインして、メダルの期限管理を始めましょう。";
    emptyState.textContent = "ログインするとメダル一覧を表示します。";
  }
}

function getDiffDays(expireDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(expireDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function getStatusInfo(expireDate) {
  const diff = getDiffDays(expireDate);
  if (diff < 0) {
    return { label: "期限切れ", className: "red", detail: `期限切れ (${Math.abs(diff)}日前)` };
  }
  if (diff === 0) {
    return { label: "本日", className: "red", detail: "期限は本日です" };
  }
  if (diff <= 7) {
    return { label: "期限近い", className: "yellow", detail: `残り ${diff} 日` };
  }
  return { label: "余裕あり", className: "green", detail: `残り ${diff} 日` };
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateForInput(dateValue) {
  const date = new Date(dateValue);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clearForm() {
  medalForm.reset();
  setDateDefault();
  extensionDaysInput.value = "30";
  editingId = null;
  submitButton.textContent = "登録する";
  formTitle.textContent = "メダル登録 / 編集";
  formModalTitle.textContent = "メダル登録 / 編集";
  cancelEditButton.classList.add("hidden");
  if (formModal && formPanel) {
    formModal.classList.add("hidden");
    formPanel.classList.remove("collapsed");
  }
}

function showForm(open = true) {
  if (!formModal || !formPanel) return;
  formModal.classList.toggle("hidden", !open);
  formPanel.classList.toggle("collapsed", !open);
  if (open) {
    cancelEditButton.classList.remove("hidden");
  } else {
    cancelEditButton.classList.add("hidden");
  }
}

function extendExpireDate(currentExpireDate, extensionDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 今日の0時
  const newDate = new Date(today);
  newDate.setDate(newDate.getDate() + extensionDays);
  return Timestamp.fromDate(newDate);
}

function renderMedals(snapshot) {
  medalList.innerHTML = "";
  if (snapshot.empty) {
    emptyState.textContent = "保存されたメダルがありません。";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const status = getStatusInfo(data.expireDate.toDate());

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="card-header">
        <div>
          <h3 class="card-title">${data.title}</h3>
          <div class="card-meta">
            <span>枚数: ${data.amount}</span>
            <span>期限: <strong>${formatDate(data.expireDate.toDate())}</strong></span>
          </div>
        </div>
        <span class="badge ${status.className}">${status.label}</span>
      </div>
      <div class="card-meta">
        <span>${status.detail}</span>
        ${data.memo ? `<span>メモ: ${data.memo}</span>` : ""}
      </div>
      <div class="card-actions">
        <button class="button secondary extend-btn">期限延長</button>
        <div class="card-actions-right">
          <button class="button secondary edit-btn">編集</button>
          <button class="button danger delete-btn">削除</button>
        </div>
      </div>
    `;

    const editButton = card.querySelector(".edit-btn");
    const extendButton = card.querySelector(".extend-btn");
    const deleteButton = card.querySelector(".delete-btn");

    editButton.addEventListener("click", () => {
      editingId = docSnap.id;
      titleInput.value = data.title;
      amountInput.value = data.amount;
      extensionDaysInput.value = data.extensionDays || 30;
      expireDateInput.value = formatDateForInput(data.expireDate.toDate());
      memoInput.value = data.memo || "";
      submitButton.textContent = "更新する";
      formTitle.textContent = "メダル更新";
      formModalTitle.textContent = "メダル更新";
      cancelEditButton.classList.remove("hidden");
      showForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    extendButton.addEventListener("click", async () => {
      const newExpireDate = extendExpireDate(data.expireDate.toDate(), data.extensionDays || 30);
      const newDateStr = formatDate(newExpireDate.toDate());
      const confirmed = await showConfirmModal("貸出期限の延長", `${newDateStr} に延長します。\nよろしいですか？`);
      if (!confirmed) return;

      try {
        await updateDoc(doc(db, "medals", docSnap.id), {
          expireDate: newExpireDate
        });
        console.log("Expire date extended for:", docSnap.id);
      } catch (error) {
        console.error("Error extending expire date:", error);
        alert("期限延長に失敗しました。");
      }
    });

    deleteButton.addEventListener("click", async () => {
      const confirmed = await showConfirmModal("削除の確認", "このメダルを削除しますか？");
      if (!confirmed) return;
      await deleteDoc(doc(db, "medals", docSnap.id));
    });

    medalList.appendChild(card);
  });
}

function subscribeMedals() {
  if (medalsUnsubscribe) {
    medalsUnsubscribe();
  }
  const medalsQuery = query(collection(db, "medals"), orderBy("expireDate", "asc"));
  medalsUnsubscribe = onSnapshot(medalsQuery, { includeMetadataChanges: true }, renderMedals, (error) => {
    console.error("Firestore snapshot error", error);
    emptyState.textContent = "データの読み込み中にエラーが発生しました。";
  });
}

loginButton.addEventListener("click", async () => {
  console.log("Login button clicked");
  try {
    console.log("Attempting signInWithPopup");
    await signInWithPopup(auth, provider);
    console.log("Sign in successful");
  } catch (error) {
    console.error("Login error:", error);
    alert("ログインに失敗しました。コンソールを確認してください。");
  }
});

toggleFormButton.addEventListener("click", () => {
  showForm(formModal.classList.contains("hidden"));
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

cancelEditButton.addEventListener("click", () => {
  clearForm();
});

medalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  console.log("Form submitted");
  if (!currentUser) {
    console.log("No user logged in");
    return;
  }

  const title = titleInput.value.trim();
  const amount = parseInt(amountInput.value, 10);
  const extensionDays = parseInt(extensionDaysInput.value, 10);
  const expireDateValue = expireDateInput.value;
  const memo = memoInput.value.trim();

  if (!title || !amount || !extensionDays || !expireDateValue) {
    alert("タイトル・枚数・延長日数・期限日を入力してください。");
    return;
  }

  const expireDate = Timestamp.fromDate(new Date(expireDateValue));
  const medalData = {
    title,
    amount,
    extensionDays,
    expireDate,
    memo,
    createdBy: currentUser.uid,
    createdAt: serverTimestamp()
  };

  try {
    if (editingId) {
      console.log("Updating medal:", editingId);
      const medalRef = doc(db, "medals", editingId);
      await updateDoc(medalRef, {
        title,
        amount,
        extensionDays,
        expireDate,
        memo
      });
      clearForm();
    } else {
      console.log("Adding new medal");
      await addDoc(collection(db, "medals"), medalData);
      medalForm.reset();
      setDateDefault();
    }
  } catch (error) {
    console.error("Save error:", error);
    alert("保存に失敗しました。もう一度お試しください。");
  }
});

onAuthStateChanged(auth, (user) => {
  console.log("Auth state changed:", user ? "Logged in" : "Logged out", user);
  currentUser = user;
  setLoadingState(!!user);
  if (user) {
    userName.textContent = user.displayName || "ログインユーザー";
    userEmail.textContent = user.email || "";
    subscribeMedals();
  } else {
    userName.textContent = "";
    userEmail.textContent = "";
    if (medalsUnsubscribe) {
      medalsUnsubscribe();
      medalsUnsubscribe = null;
    }
    medalList.innerHTML = "";
  }
});

setDateDefault();
clearForm();
