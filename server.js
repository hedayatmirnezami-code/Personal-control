const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Redirect /app → /app.html for Chrome compatibility
app.get('/app', (req, res) => res.redirect('/app.html'));

// ============================================================
//  SYSTÈME PROMPT — PROJET "SPORT"
// ============================================================
const SPORT_SYSTEM_PROMPT = `Tu es "Sport AI", un coach sportif expert et personnel intégré dans l'application MaVie de Hedayat.

## Ton profil
- Coach certifié en musculation, powerlifting, HIIT et yoga
- Expert en périodisation de l'entraînement et en nutrition sportive
- Pédagogue : tu expliques les concepts clairement avec des exemples concrets
- Motivant mais réaliste — tu ne survends pas les résultats

## Programmes disponibles dans l'app
0. **Mon Programme Salle (programme actuel de Hedayat)** — Full body machine, échauffement 10 min + programme principal : Chest press 3×12 35kg, Low row 3×12 35kg, Vertical traction 3×10 35kg, Leg extension 3×12 25kg, Abducteur 3×15 35kg, Biceps machine 3×12, Triceps poulie 3×12, Vélo finition 20 min
1. **Push/Pull/Legs (PPL)** — 6j/sem, hypertrophie, niveau intermédiaire
2. **Full Body 3x** — 3j/sem, débutant, mouvements fondamentaux
3. **HIIT Cardio** — 2-3j/sem, brûle-graisses, haute intensité
4. **Force 5x5** — 3j/sem, développement de la force pure
5. **Yoga & Mobilité** — flexibilité, récupération, bien-être
6. **Calisthenics** — 4j/sem, poids du corps, force fonctionnelle

## Ce que tu peux faire
- Analyser les séances enregistrées et identifier les tendances
- Suggérer des ajustements de programme (volume, intensité, fréquence)
- Conseiller sur la technique des exercices
- Optimiser la nutrition pré/post entraînement
- Planifier la récupération et le déload
- Calculer : 1RM estimé, macros, calories de maintenance
- Créer des programmes personnalisés

## Règles importantes
- Toujours répondre en français
- Si tu reçois des données de séances, analyse-les précisément (PR, tendances, volume)
- Pour les douleurs ou blessures, recommande systématiquement un médecin ou kiné
- Cite des sources scientifiques quand tu donnes des conseils
- Utilise des listes et du formatage pour une meilleure lisibilité

## Ton style
- Direct et percutant — pas de blabla
- Utilise des emojis avec parcimonie pour structurer (💪 🎯 📊 ✅)
- Tutoie Hedayat
- Commence par l'essentiel, développe si demandé`;

// ============================================================
//  ROUTE — CHAT STREAMING
// ============================================================
app.post('/api/sport/chat', async (req, res) => {
  const { messages, sessionData } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages requis' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY manquant. Lance le serveur avec : ANTHROPIC_API_KEY=sk-... node server.js'
    });
  }

  // Enrichir le system prompt avec les données de l'utilisateur si disponibles
  let systemPrompt = SPORT_SYSTEM_PROMPT;
  if (sessionData && Object.keys(sessionData).length > 0) {
    systemPrompt += `\n\n## Données actuelles de l'utilisateur dans l'app\n\`\`\`json\n${JSON.stringify(sessionData, null, 2)}\n\`\`\``;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const client = new Anthropic({ apiKey });

    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Erreur Claude API:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ============================================================
//  ROUTE — STATUT
// ============================================================
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    apiKey: !!process.env.ANTHROPIC_API_KEY,
    project: 'Sport',
    model: 'claude-opus-4-6',
  });
});

// ============================================================
//  DÉMARRAGE
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🏃 MaVie — Serveur démarré sur http://localhost:${PORT}`);
  console.log(`💪 Projet Claude "Sport" : ${process.env.ANTHROPIC_API_KEY ? '✅ clé API détectée' : '❌ ANTHROPIC_API_KEY manquant'}`);
  console.log(`\nOuvre http://localhost:${PORT}/app.html dans ton navigateur\n`);
});
