# Boutique DIAMOND

La boutique se trouve dans `boutique-diamond/`, afin de rester isolée des autres projets du dépôt.

## Déploiement sur Cloudflare Pages

1. Dans Cloudflare, ouvre **Workers & Pages** et crée (ou sélectionne) le projet Pages lié au dépôt `eeesssadi/Diamond`.
2. Dans **Build settings**, définis `boutique-diamond` comme répertoire racine. Il n’y a pas de commande de build et le répertoire de sortie est `.`.
3. Dans **Storage & databases > D1**, crée une base de données, par exemple `diamond-db`.
4. Dans le projet Pages, ouvre **Settings > Functions > D1 database bindings**, ajoute un binding nommé exactement `DB` et sélectionne la base créée. Le nom `DB` doit correspondre à `env.DB` dans les fonctions.
5. Dans les variables d’environnement et secrets du projet Pages, ajoute `ADMIN_KEY` comme secret avec une valeur longue, aléatoire et unique. Ne l’ajoute jamais au dépôt.
6. Enregistre les réglages, puis relance un déploiement (un nouveau déploiement est nécessaire pour appliquer les bindings et secrets).
7. Vérifie `/api/store`, puis ouvre `/` pour la boutique et `/admin.html` pour l’administration.

Les tables sont créées automatiquement au premier appel à l’API. Les données (produits et réglages) sont enregistrées dans D1. Le code n’utilise pas KV. Les images et vidéos doivent être accessibles par une URL publique `https://`. Les commandes sont envoyées via WhatsApp.

## Administration

Ouvre `/admin.html`, saisis la valeur du secret `ADMIN_KEY` et enregistre-la. La clé est conservée uniquement dans la session du navigateur. Tu peux ensuite ajouter, modifier ou supprimer des produits et régler le nom de la boutique, le numéro WhatsApp et les médias de la page d’accueil.

## Important pour Wrangler

`wrangler.toml` ne contient volontairement aucun identifiant D1 fictif. Le binding de production se configure dans le tableau de bord Pages comme décrit ci-dessus. Pour lancer le projet localement avec Wrangler, il faut aussi déclarer dans la configuration locale un binding `DB` avec le vrai `database_id` de ta base et configurer `ADMIN_KEY` comme variable/secrète locale. La création du binding dans le tableau de bord Pages ne crée pas automatiquement une base et ne corrige pas un binding absent. 
