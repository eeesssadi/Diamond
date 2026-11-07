# Boutique DIAMOND

Cette boutique est ajoutée dans son propre dossier pour ne pas modifier les fichiers des autres projets : `boutique-diamond/`.

## Mise en ligne avec Cloudflare Pages

1. Dans Cloudflare Pages, crée un projet lié au dépôt `eeesssadi/Diamond` (ou configure un projet existant sans changer les autres projets).
2. Dans **Build settings**, choisis `boutique-diamond` comme **Root directory**. Il n’y a pas de commande de build.
3. Crée une base D1 nommée `diamond-db`.
4. Dans les paramètres Pages → **Settings → Functions → D1 database bindings**, ajoute le binding `DB` et sélectionne cette base.
5. Dans les variables d’environnement et secrets du projet Pages, ajoute le secret `ADMIN_KEY` avec une clé longue et unique. Ne mets jamais cette clé dans les fichiers du dépôt et ne la partage pas.
6. Déploie le projet. La boutique est à `/` et l’administration à `/admin.html`.

Les tables sont créées automatiquement au premier appel à `/api/store`. Les images et vidéos doivent être des liens publics commençant par `https://`. Les commandes sont envoyées via WhatsApp ; aucun paiement en ligne n’est configuré.

## Utilisation de l’administration

Ouvre `/admin.html`, saisis la valeur secrète de `ADMIN_KEY`, puis enregistre-la. Tu peux ajouter/modifier/supprimer des produits et renseigner le nom, le numéro WhatsApp (avec indicatif international), ainsi que les liens vers tes images/vidéos. La clé reste dans la session du navigateur et n’est pas écrite dans le dépôt.

## Important

Le code de la boutique est isolé dans ce dossier. Le dépôt ne contient pas les identifiants Cloudflare : le binding D1 et le secret doivent être configurés dans le tableau de bord Cloudflare. N’envoie pas de mot de passe, clé secrète ou token dans le chat.
