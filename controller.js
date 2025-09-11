
document.addEventListener('DOMContentLoaded', () => {

     // --- 1. DOM ELEMENTLERİ ---
     const authContainer = document.getElementById('auth-container');
     const appWrapper = document.getElementById('app-wrapper');
     const loginForm = document.getElementById('login-form');
     const registerForm = document.getElementById('register-form');
     const showRegisterLink = document.getElementById('show-register');
     const showLoginLink = document.getElementById('show-login');
     const currentUserInfo = document.getElementById('current-user-info');
     const logoutBtn = document.getElementById('logout-btn');
     const userList = document.getElementById('user-list');
     const rightPanel = document.querySelector('.right-panel');
     const welcomeScreen = document.getElementById('welcome-screen');
     const chatViewActive = document.getElementById('chat-view-active');
     const chatHeader = document.getElementById('chat-with-user');
     const chatPartnerStatus = document.getElementById('chat-partner-status');
     const editNicknameBtn = document.getElementById('edit-nickname-btn');
     const messagesContainer = document.getElementById('messages-container');
     const typingIndicatorContainer = document.getElementById('typing-indicator-container');
     const chatForm = document.getElementById('chat-form');
     const messageInput = document.getElementById('message-input');
     const attachmentBtn = document.getElementById('attachment-btn');
     const imageInput = document.getElementById('image-input');
     const fabContainer = document.querySelector('.fab-container');
     const fabMainBtn = document.getElementById('fab-main-btn');

     const fullscreenPanels = document.querySelectorAll('.fullscreen-panel');
     const fabNewContactBtn = document.querySelector('.fab-button-small[title="Yeni Kişi Ekle"]');
     const fabNewGroupBtn = document.querySelector('.fab-button-small[title="Yeni Grup Oluştur"]');
     const backBtns = document.querySelectorAll('.back-btn');

     // --- Ayarlar Ekranı Mantığı ---
     const settingsBtn = document.getElementById('settings-btn');
     const settingsScreen = document.getElementById('settings-screen');
     const settingsAvatar = document.getElementById('settings-avatar');
     const settingsUsername = document.getElementById('settings-username');
     const settingsEmail = document.getElementById('settings-email');
     const themeToggle = document.getElementById('theme-toggle');

     // --- 2. UYGULAMA DURUMU (STATE) ---
     let currentUser = null;
     let currentChatPartnerId = null;
     let currentChatListener = null;
     let typingTimeout = null;
     let userNicknames = {};
     let activeListeners = {};

     auth.onAuthStateChanged(user => {
          if (user) {
               currentUser = user;
               const userInfo = { email: currentUser.email, uid: currentUser.uid };
               usersRef.child(currentUser.uid).update(userInfo);
               setupPresence(currentUser.uid);
               fetchNicknames();
               authContainer.style.display = 'none';
               appWrapper.style.display = 'flex';
               currentUserInfo.textContent = currentUser.email;
               fetchAndDisplayUsers();
          } else {
               authContainer.style.display = 'flex';
               appWrapper.style.display = 'none';
               if (activeListeners) { Object.values(activeListeners).forEach(ref => ref.off()); }
               activeListeners = {};
          }
     });

     settingsBtn.addEventListener('click', () => {
          const displayName = userNicknames[currentUser.uid]?.nickname || currentUser.email.split('@')[0];
          settingsUsername.textContent = displayName;
          settingsEmail.textContent = currentUser.email;

          const initial = displayName.charAt(0).toUpperCase();
          const avatarColor = getColorForUser(currentUser.uid);
          settingsAvatar.textContent = initial;
          settingsAvatar.style.backgroundColor = avatarColor;

          showPanel('settings-screen')
     });

     const currentTheme = localStorage.getItem('theme') || 'light';
     document.documentElement.setAttribute('data-theme', currentTheme);
     if (currentTheme === 'dark') {
          themeToggle.checked = true;
     }

     themeToggle.addEventListener('change', () => {
          if (themeToggle.checked) {
               document.documentElement.setAttribute('data-theme', 'dark');
               localStorage.setItem('theme', 'dark');
          } else {
               document.documentElement.setAttribute('data-theme', 'light');
               localStorage.setItem('theme', 'light');
          }
     });

     function showPanel(panelId) {
          document.getElementById('auth-container').style.display = 'none';
          document.getElementById('app-wrapper').style.display = 'none';
          fullscreenPanels.forEach(p => p.style.display = 'none');

          const targetPanel = document.getElementById(panelId);
          if (targetPanel) {
               targetPanel.style.display = 'flex';
          }
     }

     fabNewContactBtn.addEventListener('click', () => {
          showPanel('new-contact-screen');
          fabContainer.classList.remove('active');
     });

     fabNewGroupBtn.addEventListener('click', () => {
          showPanel('new-group-screen');
          fabContainer.classList.remove('active');
     });

     backBtns.forEach(btn => {
          btn.addEventListener('click', () => {
               const targetPanelId = btn.dataset.target;
               showPanel(targetPanelId);
          });
     });
     document.addEventListener('click', (event) => {
          if (!fabContainer.contains(event.target) && fabContainer.classList.contains('active')) {
               fabContainer.classList.remove('active');
          }
     });


     fabMainBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          fabContainer.classList.toggle('active');
     });

     function setupPresence(uid) {
          const userStatusRef = usersRef.child(uid);
          db.ref('.info/connected').on('value', (snapshot) => {
               if (snapshot.val() === false) { return; }
               userStatusRef.onDisconnect().update({ status: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP })
                    .then(() => { userStatusRef.update({ status: 'online' }); });
          });
     }

     logoutBtn.addEventListener('click', () => {
          const isConfirmed = window.confirm('Hesabınızdan çıkış yapmak istediğinize emin misiniz?');
          if (isConfirmed) {
               usersRef.child(currentUser.uid).update({ status: 'offline', lastSeen: firebase.database.ServerValue.TIMESTAMP })
                    .then(() => {
                         auth.signOut();
                    });
          }
     });

     registerForm.addEventListener('submit', (e) => {
          e.preventDefault();
          auth.createUserWithEmailAndPassword(registerForm.email.value, registerForm.password.value)
               .then(cred => { usersRef.child(cred.user.uid).set({ email: cred.user.email, uid: cred.user.uid }); })
               .catch(err => alert(err.message));
     });

     loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          auth.signInWithEmailAndPassword(loginForm.email.value, loginForm.password.value).catch(err => alert(err.message));
     });
     showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; registerForm.style.display = 'block'; });
     showLoginLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'block'; registerForm.style.display = 'none'; });

     function fetchNicknames() {
          if (!currentUser) return;
          const nicknamesRef = usersRef.child(currentUser.uid).child('contacts');
          nicknamesRef.on('value', snapshot => { userNicknames = snapshot.val() || {}; });
     }

     function fetchAndDisplayUsers() {
          usersRef.on('value', snapshot => {
               const users = snapshot.val();
               userList.innerHTML = '';
               if (!users) return;
               Object.values(users).forEach(user => {
                    if (currentUser && user.uid !== currentUser.uid) {
                         const displayName = userNicknames[user.uid]?.nickname || user.email.split('@')[0];
                         const initial = displayName.charAt(0).toUpperCase();
                         const avatarColor = getColorForUser(user.uid);
                         const onlineClass = user.status === 'online' ? 'online' : '';
                         const userItem = document.createElement('div');
                         userItem.className = 'user-item';
                         userItem.dataset.uid = user.uid;
                         userItem.dataset.email = user.email;
                         userItem.innerHTML = `<div class="avatar-wrapper ${onlineClass}"><div class="user-avatar" style="background-color: ${avatarColor};">${initial}</div></div><div class="user-info"><div class="user-item-main"><span class="username">${displayName}</span></div><div class="user-item-status"></div></div>`;
                         userList.appendChild(userItem);
                         const chatId = getChatId(currentUser.uid, user.uid);
                         const typingRef = chatsRef.child(chatId).child('typing').child(user.uid);
                         if (activeListeners[chatId]) activeListeners[chatId].off();
                         activeListeners[chatId] = typingRef;
                         typingRef.on('value', typingSnapshot => {
                              const statusElement = userItem.querySelector('.user-item-status');
                              if (typingSnapshot.val() === true) {
                                   statusElement.textContent = 'yazıyor...';
                                   statusElement.classList.add('typing');
                              } else {
                                   statusElement.classList.remove('typing');
                                   statusElement.textContent = user.status === 'online' ? 'Çevrimiçi' : formatTimestamp(user.lastSeen);
                              }
                         });
                    }
               });
          });
     }

     userList.addEventListener('click', (e) => {
          const userItem = e.target.closest('.user-item');
          if (userItem) {
               document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
               userItem.classList.add('active');
               const partnerId = userItem.dataset.uid;
               const displayName = userNicknames[partnerId]?.nickname || user.email.split('@')[0];
               currentChatPartnerId = partnerId;
               welcomeScreen.style.display = 'none';
               chatViewActive.style.display = 'flex';
               fabContainer.style.display = 'none';
               chatHeader.textContent = displayName;
               chatPartnerStatus.textContent = '';
               loadMessages(partnerId);
               rightPanel.classList.add('active');
          }
     });

     editNicknameBtn.addEventListener('click', () => {
          if (!currentChatPartnerId) return;
          const currentNickname = userNicknames[currentChatPartnerId]?.nickname || '';
          const newNickname = prompt('Bu kişi için bir takma ad girin:', currentNickname);
          if (newNickname !== null) {
               usersRef.child(currentUser.uid).child('contacts').child(currentChatPartnerId).set({ nickname: newNickname })
                    .then(() => { chatHeader.textContent = newNickname; fetchAndDisplayUsers(); });
          }
     });

     function loadMessages(partnerId) {
          if (currentChatListener) { Object.values(currentChatListener).forEach(ref => ref.off()); }
          typingIndicatorContainer.innerHTML = '';
          messagesContainer.innerHTML = `<div class="loader-wrapper"><div class="loader-spinner"></div><span>Mesajlar yükleniyor...</span></div>`;
          const chatId = getChatId(currentUser.uid, partnerId);
          const messagesRef = chatsRef.child(chatId).child('messages').orderByChild('timestamp');
          const partnerTypingRef = chatsRef.child(chatId).child('typing').child(partnerId);
          const partnerStatusRef = usersRef.child(partnerId);
          currentChatListener = { messages: null, typing: partnerTypingRef, status: partnerStatusRef };

          messagesRef.once('value', snapshot => {
               messagesContainer.innerHTML = '';
               const messages = snapshot.val();
               let lastTimestamp = 0;
               if (messages) {
                    Object.values(messages).forEach(message => displayMessage(message));
                    const messageKeys = Object.keys(messages);
                    lastTimestamp = messages[messageKeys[messageKeys.length - 1]].timestamp;
               }
               const newMessagesRef = lastTimestamp > 0 ? messagesRef.startAt(lastTimestamp + 1) : messagesRef;
               newMessagesRef.on('child_added', newSnapshot => {
                    if (newSnapshot.val().timestamp > lastTimestamp) { displayMessage(newSnapshot.val()); }
               });
               currentChatListener.messages = newMessagesRef;
          });

          partnerTypingRef.on('value', snapshot => {
               if (snapshot.val() === true) {
                    chatPartnerStatus.textContent = '';
                    typingIndicatorContainer.innerHTML = `<div class="typing-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
               } else {
                    typingIndicatorContainer.innerHTML = '';
                    partnerStatusRef.once('value', userSnap => {
                         const user = userSnap.val();
                         if (user) chatPartnerStatus.textContent = user.status === 'online' ? 'Çevrimiçi' : `Son görülme: ${formatTimestamp(user.lastSeen)}`;
                    });
               }
          });
          partnerStatusRef.on('value', snapshot => {
               const user = snapshot.val();
               if (user && typingIndicatorContainer.innerHTML === '') {
                    chatPartnerStatus.textContent = user.status === 'online' ? 'Çevrimiçi' : `Son görülme: ${formatTimestamp(user.lastSeen)}`;
               }
          });
     }

     messageInput.addEventListener('input', () => {
          if (!currentChatPartnerId) return;
          clearTimeout(typingTimeout);
          const typingRef = chatsRef.child(getChatId(currentUser.uid, currentChatPartnerId)).child('typing').child(currentUser.uid);
          typingRef.set(true);
          typingTimeout = setTimeout(() => { typingRef.set(false); }, 2000);
     });

     chatForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const text = messageInput.value.trim();
          if (text && currentChatPartnerId) {
               clearTimeout(typingTimeout);
               chatsRef.child(getChatId(currentUser.uid, currentChatPartnerId)).child('typing').child(currentUser.uid).set(false);
               sendMessage({ type: 'text', text });
               messageInput.value = '';
          }
     });

     attachmentBtn.addEventListener('click', () => {
          imageInput.click();
     });

     imageInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file && currentChatPartnerId) handleImageSelection(file);
          imageInput.value = '';
     });

     function getColorForUser(uid) {
          const colors = ['#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047', '#7cb342', '#c0ca33', '#fdd835', '#ffb300', '#fb8c00', '#f4511e', '#6d4c41', '#757575', '#546e7a'];
          const sum = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return colors[sum % colors.length];
     }
     function formatTimestamp(timestamp) {
          if (!timestamp) return '';
          const now = new Date(); const date = new Date(timestamp); const diff = now - date;
          const minutes = Math.floor(diff / 1000 / 60);
          if (minutes < 1) return 'şimdi'; if (minutes < 60) return `${minutes} dk önce`;
          if (minutes < 1440) return `${Math.floor(minutes / 60)} sa önce`; if (minutes < 2880) return 'Dün';
          return date.toLocaleDateString('tr-TR');
     }

     /**
      * @param {number} timestamp - Firebase'den gelen tarih damgası.
      * @returns {string} - Formatlanmış tarih ve saat.
      */
     function formatFullTimestamp(timestamp) {
          if (!timestamp) return '';

          const aylar = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

          const date = new Date(timestamp);

          const gun = date.getDate();
          const ay = aylar[date.getMonth()];
          const yil = date.getFullYear();
          const saat = String(date.getHours()).padStart(2, '0');
          const dakika = String(date.getMinutes()).padStart(2, '0');

          return `${gun} ${ay} ${yil} ${saat}:${dakika}`;
     }

     function displayMessage(message, prepend = false) {
          const isSent = message.senderId === currentUser.uid;
          const bubble = document.createElement('div');
          bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
          bubble.dataset.messageId = message.id;

          let content = '';
          if (message.type === 'text') {
               content = `<div class="message-content">${message.text}</div>`;
          } else if (message.type === 'image') {
               content = `<div class="message-content"><img src="${message.base64}" alt="Fotoğraf"></div>`;
          } else if (message.type === 'video') {
               content = `<div class="message-content"><video src="${message.base64}" controls preload="metadata"></video></div>`;
          }

          const meta = `
        <div class="message-meta">
            <span class="timestamp">${formatFullTimestamp(message.timestamp)}</span>
            ${isSent ? `<span class="ticks ${message.status === 'read' ? 'read' : ''}">
                            <i class="fas ${message.status === 'read' ? 'fa-check-double' : 'fa-check'}"></i>
                        </span>` : ''}
        </div>`;

          bubble.innerHTML = content + meta;

          if (prepend) {
               messagesContainer.insertBefore(bubble, document.getElementById('older-messages-loader').nextSibling);
          } else {
               messagesContainer.appendChild(bubble);
               messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
     }
     function getChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }
     function sendMessage(messageContent) {
          const chatId = getChatId(currentUser.uid, currentChatPartnerId);
          chatsRef.child(chatId).child('messages').push({ senderId: currentUser.uid, timestamp: firebase.database.ServerValue.TIMESTAMP, ...messageContent });
     }
     function handleImageSelection(file) {
          const MAX_WIDTH = 800, MAX_HEIGHT = 800, JPEG_QUALITY = 0.8;
          const reader = new FileReader();
          reader.onload = (event) => {
               const img = new Image(); img.src = event.target.result;
               img.onload = () => {
                    let { width, height } = img;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                    const base64String = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
                    sendMessage({ type: 'image', base64: base64String });
               };
          };
          reader.readAsDataURL(file);
     }
     function createBackButton() {
          if (document.getElementById('back-to-users-btn')) return;
          const backBtn = document.createElement('button');
          backBtn.id = 'back-to-users-btn';
          backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
          backBtn.onclick = () => {
               rightPanel.classList.remove('active');
               currentChatPartnerId = null;
               fabContainer.style.display = 'flex';
               if (currentChatListener) {
                    Object.values(currentChatListener).forEach(ref => ref.off());
               }
          };
          document.querySelector('.right-panel .panel-header').prepend(backBtn);
     }
     createBackButton();
});