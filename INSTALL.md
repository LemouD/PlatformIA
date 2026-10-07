# Installer et lancer AI OS

Ce guide décrit ce qui fonctionne aujourd'hui : l'interface sur données fictives. Les étapes qui dépendent du serveur et du moteur d'agents, encore en construction, sont regroupées à la fin, dans « À venir », et marquées comme telles.

## 1. Prérequis

| Outil | Version | Vérifier |
|---|---|---|
| Node.js | 24 | `node -v` |
| npm | fourni avec Node.js | `npm -v` |
| Git | récente | `git --version` |

Mémoire : prévoir au moins 4 Go de RAM libres pour `npm run build`. Sur une machine plus juste, le build est très lent, voire échoue faute de mémoire. Le mode développement en demande moins.

## 2. Récupérer le projet

```bash
git clone https://github.com/LemouD/PlatformIA.git
```

```bash
cd PlatformIA
```

## 3. Installer les dépendances

```bash
npm ci --ignore-scripts
```

- `npm ci` installe exactement les versions figées dans `package-lock.json`. N'utilisez pas `npm install`, qui peut les faire évoluer.
- `--ignore-scripts` empêche les dépendances d'exécuter du code sur votre machine pendant l'installation. Le projet n'en a pas besoin, et c'est ainsi que l'installe la CI.

## 4. Lancer en mode développement

```bash
npm run dev
```

Ouvrez http://localhost:3000. Les modifications du code s'affichent sans redémarrer.

Le mode développement est réservé au développement : il expose le code source et des points d'accès internes. Ne l'ouvrez jamais au réseau.

## 5. Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'interface en mode développement |
| `npm test` | Lance tous les tests une fois |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run lint` | Vérifie le style et les erreurs courantes |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run build` | Construit la version de production |
| `npm run start` | Lance la version construite (voir section 6) |

Avant de proposer une modification, lancez au minimum `npm run lint`, `npm run typecheck` et `npm test` : la CI fera les mêmes vérifications et bloquera la fusion en cas d'échec.

## 6. Lancer comme en usage réel

```bash
npm run build
```

```bash
npm run start -- -H 127.0.0.1
```

L'option `-H 127.0.0.1` est indispensable. Sans elle, `next start` écoute sur toutes les interfaces réseau : n'importe quel appareil du réseau local pourrait joindre l'application, alors qu'elle n'a pas encore d'authentification. Pour accéder à AI OS depuis un autre appareil, passez par Tailscale (section 8), jamais par une écoute réseau.

## 7. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Port 3000 is already in use` | Une autre application occupe le port | `npm run dev -- -p 3001`, puis ouvrir http://localhost:3001 |
| `npm ci` refuse de s'exécuter | `package-lock.json` absent ou désynchronisé | Récupérer la dernière version de `main` ; ne pas régénérer le fichier de verrouillage soi-même |
| Le build s'arrête sur un manque de mémoire | Moins de 4 Go de RAM libres | Fermer les autres applications, ou construire sur une machine plus puissante |
| Version de Node.js refusée | Node.js trop ancien | Installer Node.js 24 |

## 8. À venir

Ces étapes ne fonctionnent pas encore. Elles sont décrites pour montrer où va le projet, et seront complétées quand le code existera.

**Clé API et configuration** (étape 2 de la feuille de route)
- La clé de l'API Claude sera lue depuis un fichier `.env` côté serveur. Un modèle sans valeur réelle, `.env.example`, sera fourni.
- Ne commitez jamais le fichier `.env`. Réglez aussi un plafond de dépense mensuel dans la console Anthropic.

**Base de données**
- La base SQLite sera stockée hors du dossier du projet, par exemple dans `%LOCALAPPDATA%\ai-os\` sous Windows ou `/var/lib/ai-os/` sur un Raspberry Pi. Elle ne doit être lisible que par le compte qui lance l'application.

**Premier démarrage**
- Au premier lancement, le serveur affichera dans la console un code à usage unique, demandé pour créer le compte. Personne d'autre ne pourra ainsi choisir le mot de passe à votre place.

**Accès depuis vos autres appareils**
- Installer Tailscale sur la machine qui héberge AI OS et sur vos appareils personnels, puis exposer l'application à votre seul réseau Tailscale :

```bash
tailscale serve --bg --https=443 http://127.0.0.1:3000
```

- N'utilisez jamais `tailscale funnel`, qui publierait l'application sur tout Internet. N'ouvrez aucun port sur votre box.
- Attendez que l'authentification soit livrée avant de le faire.
