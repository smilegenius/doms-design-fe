const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chrome = '/c/Program Files/Google/Chrome/Application/chrome.exe';
const outDir = 'D:/dental-saas-supplier-portal/dental-project/figma-screens';
const profileDir = outDir + '/chrome-profile';
fs.mkdirSync(profileDir, { recursive: true });

// First, navigate to login and sign in to set session
const loginScript = `
  (async () => {
    const e = document.querySelector('input[type=email]');
    const p = document.querySelector('input[type=password]');
    if (e && p) {
      const niv = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      niv.call(e,'admin@smilegenius.com'); e.dispatchEvent(new Event('input',{bubbles:true}));
      niv.call(p,'password123'); p.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('button[type=submit],button')?.click();
    }
  })();
`;

console.log('Chrome capture setup ready');
