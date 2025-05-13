![voicemail](https://github.com/user-attachments/assets/3f1b4f17-7147-4f29-89ce-01fcba3909f6)

P2P Voicemail On Bitcoin
Send encrypted, peer-to-peer, on-chain voicemail with attached micropayments while utilizing your encrypted contact list.

![CARS](https://github.com/user-attachments/assets/abb11c0b-781d-4c32-9979-4356856a7604)

With these new tools being developed by Project Babbage and others, there are opportunities to make almost everything peer-to-peer.

Project Incorporates
-Metanet Desktop Client
-Output Baskets
-Micropaymemts
-IdentitySearchField, Identity, IdentityCard from '@bsv/identity-react'
-WalletClient, Utils, Transaction, PushDrop, LockingScript from '@bsv/sdk'
-CARS deployment: frontend.e42e1a64b1fee160b88e02160d70feec.projects.babbage.systems

Standard BSV project structure.

Helpful Links:

- [LARS (for local development)](https://github.com/bitcoin-sv/lars)
- [CARS CLI (for cloud deployment)](https://github.com/bitcoin-sv/cars-cli)
- [RUN YOUR OWN CARS NODE](https://github.com/bitcoin-sv/cars-node)
- [Specification for deployment-info.json](https://github.com/bitcoin-sv/BRCs/blob/master/apps/0102.md)

## Getting Started

- Clone this repository
- Run `npm i` to install dependencies
- Run `npm run lars` to configure the local environment according to your needs
- Use `npm run start` to spin up and start writing code
- When you're ready to publish your project, start by running `npm run cars` and configuring one (or, especially for overlays, ideally multiple) hosting provider(s)
- For each of your configurations, execute `npm run build` to create CARS project artifacts
- Deploy with `npm run deploy` and your project will be online
- Use `cars` interactively, or visit your hosting provider(s) web portals, to view logs, configure custom domains, and pay your hosting bills
- Share your new BSV project, it is now online!

## Directory Structure

The project structure is roughly as follows, although it can vary by project.

```
| - deployment-info.json
| - package.json
| - local-data/
| - frontend/
  | - package.json
  | - webpack.config.js
  | - src/...
  | - public/...
  | - build/...
| - backend/
  | - package.json
  | - tsconfig.json
  | - mod.ts
  | - src/
    | - contracts/...
    | - lookup-services/...
    | - topic-managers/...
    | - script-templates/...
  | - artifacts/
  | - dist/
```

The one constant is `deployment-info.json`.

## License

[Open BSV License](./LICENSE.txt)
