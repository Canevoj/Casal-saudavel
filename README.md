# ⚡ Health Battle — Casal Saudável

App gamificado para Lucas e Josi competirem em saúde com sincronização em tempo real via Firebase.

---

## 🚀 Como subir no Vercel (passo a passo)

### Pré-requisitos
- Conta no [GitHub](https://github.com) (gratuita)
- Conta no [Vercel](https://vercel.com) (gratuita, entre com o GitHub)

---

### Passo 1 — Criar repositório no GitHub

1. Acesse **github.com** e clique em **"New repository"**
2. Nome: `casal-saudavel`
3. Deixe **Público** e clique em **"Create repository"**
4. Faça upload de todos os arquivos desta pasta:
   - Clique em **"uploading an existing file"**
   - Arraste a pasta inteira ou os arquivos um por um
   - Mantenha a estrutura: `src/App.jsx`, `src/index.js`, `src/firebase.js`, `public/index.html`, `package.json`
   - Clique em **"Commit changes"**

---

### Passo 2 — Subir no Vercel

1. Acesse **vercel.com** e clique em **"Add New Project"**
2. Conecte ao GitHub e selecione o repositório `casal-saudavel`
3. O Vercel vai detectar automaticamente que é React
4. Clique em **"Deploy"**
5. Aguarde ~2 minutos — pronto! ✅

O Vercel vai gerar um link tipo:
```
https://casal-saudavel.vercel.app
```

---

### Passo 3 — Usar no celular

1. Abra o link no celular (funciona em qualquer navegador)
2. **iPhone:** Compartilhar → "Adicionar à Tela de Início"
3. **Android:** Menu (3 pontos) → "Adicionar à tela inicial"

Vai aparecer como ícone na tela, igual a um app! 📱

---

## 🔥 Firebase já configurado

O projeto já usa o Firebase do projeto `casal-saudavel`.  
Os dados de Lucas e Josi sincronizam em tempo real entre os dois celulares.

---

## 📁 Estrutura dos arquivos

```
casal-saudavel/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx        ← App principal
│   ├── firebase.js    ← Configuração do Firebase
│   └── index.js       ← Entry point
├── package.json
└── README.md
```
