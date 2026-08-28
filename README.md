# Pokémon → eBay — V1 mobile

## Objectif
Prototype 100 % gratuit et utilisable depuis Android pour :
- prendre le recto et le verso d'une carte ;
- faire un OCR du recto ;
- rechercher une correspondance dans TCGdex ;
- générer automatiquement un titre et une description ;
- conserver les paramètres eBay : enchère 7 jours, départ 1 €, Mondial Relay 4 € ;
- exporter une fiche JSON.

## Important
Cette V1 ne publie pas encore directement sur eBay. La publication directe nécessite une intégration eBay OAuth et les paramètres de vente du compte (notamment politiques d'expédition). eBay indique que son programme développeur est gratuit et que les API Sell permettent la création d'annonces, mais cette partie doit être configurée et testée avant de passer en production.

## Installation sans PC
1. Depuis Android, créez un compte GitHub si nécessaire.
2. Créez un nouveau dépôt public, par exemple `pokemon-ebay-mobile`.
3. Importez les 4 fichiers de ce dossier à la racine : `index.html`, `app.js`, `style.css`, `manifest.webmanifest`.
4. Dans GitHub : Settings → Pages → Deploy from branch → `main` → `/root`.
5. Ouvrez l'URL GitHub Pages en HTTPS sur Android.
6. Autorisez l'appareil photo si le navigateur le demande.
7. Ajoutez la page à l'écran d'accueil.

## Test
- photographiez une carte française, recto puis verso ;
- appuyez sur « Analyser la carte » ;
- vérifiez le texte OCR ;
- appuyez sur « Rechercher dans TCGdex » ;
- choisissez la bonne carte ;
- contrôlez le titre et la description.

## Limites V1
- l'OCR peut être imparfait selon les reflets, l'angle et la police ;
- la détection automatique des quatre coins n'est pas encore activée ;
- la paire de photos n'est pas encore envoyée à eBay ;
- la publication eBay directe est volontairement laissée pour V2 afin d'éviter de demander des identifiants/API avant validation du prototype.
