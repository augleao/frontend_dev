# Documentação das APIs - backend_dev

## Autenticação e Usuário
- **POST /api/signup**
  - Cria um novo usuário.
- **POST /api/login**
  - Realiza login e retorna token JWT.
- **GET /api/profile**
  - Retorna dados do usuário autenticado.

## Atos e Atos Pagos
- **GET /api/atos**
  - Lista todos os atos.
- **GET /api/atos/:id**
  - Busca um ato pelo ID.
- **POST /api/atos**
  - Cria um novo ato (requer autenticação e permissão de registrador).
- **PUT /api/atos/:id**
  - Atualiza um ato existente.
- **GET /api/atos-pagos**
  - Lista todos os atos pagos.
- **POST /api/atos-pagos**
  - Cria um novo registro de ato pago.
- **DELETE /api/atos-pagos/:id**
  - Remove um ato pago pelo ID.

## Atos Praticados
- **GET /api/atos-praticados**
  - Lista atos praticados.
- **POST /api/atos-praticados**
  - Cria um novo registro de ato praticado.

## Atos Tabela
- **GET /api/atos-tabela**
  - Lista a tabela de atos.
- **POST /api/atos-tabela**
  - Adiciona um novo item à tabela de atos.
- **DELETE /api/atos-tabela/:id**
  - Remove um item da tabela de atos.

## Importação e Upload
- **POST /api/importar-atos-pdf**
  - Importa atos a partir de arquivos PDF.
- **POST /api/upload**
  - Faz upload de arquivos (autenticado).

## Averbações Gratuitas
- **GET /api/averbacoes-gratuitas**
  - Lista averbações gratuitas. O payload agora inclui `anexo_url` e o alias `anexoUrl` (quando disponível).
- **POST /api/averbacoes-gratuitas/:id/anexo** *(autenticado)*
  - Recebe um PDF (campo `file`) em multipart/form-data, armazena o documento na Document Library configurada no SharePoint/OneDrive e salva a URL em `averbacoes_gratuitas.anexo_url`.

## Integração Microsoft Graph / SharePoint
- Variáveis de ambiente necessárias:
  - `AZURE_TENANT_ID`
  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`
  - `SHAREPOINT_DRIVE_ID`
- O aplicativo Azure AD deve possuir consentimento para `Sites.Selected` (com compartilhamento via Grant) ou `Files.ReadWrite.All`.
- O `SHAREPOINT_DRIVE_ID` pode ser obtido pela Graph API (`/sites/{site-id}/drives`) ou Graph Explorer.
- Os uploads usam sessões com comportamento de conflito `replace`. PDFs de até 20 MB são suportados via upload segmentado (lotes de 320 KB).

## Configuração do OneDrive (somente administradores)
- **GET /api/onedrive-config**
  - Retorna a configuração atual (200) ou 404 se não houver registro. O payload inclui `driveId` (alias `sharepointDriveId`).
- **POST /api/onedrive-config**
 - **POST /api/onedrive-config**
  - Cria a configuração. Exige `clientId`, `clientSecret`, `redirectUri`, `refreshToken`, `folderPath` e `driveId` (aceita também `sharepointDriveId`). `tenant` continua opcional e padrão `consumers`. `folderPath` e `driveId` são normalizados (trim, sem “/” inicial) e devem ser preenchidos. Retorna 201 ou 409 se já existir um registro.
- **PUT /api/onedrive-config/:id**
  - Atualiza parcialmente um registro existente (`clientId`, `clientSecret`, `redirectUri`, `tenant`, `refreshToken`, `folderPath`, `driveId`). `folderPath` e `driveId`, quando enviados, são normalizados e não podem ficar vazios. Retorna 200 com o JSON atualizado ou 404 se não encontrado.
- **DELETE /api/onedrive-config/:id**
  - Remove o registro e retorna 204 quando concluído.

## Execução de Serviço e Selos
- **POST /api/execucao-servico**
  - Cria uma execução de serviço.
- **GET /api/execucao-servico/:protocolo**
  - Busca execução de serviço por protocolo.
- **PUT /api/execucao-servico/:id**
  - Atualiza execução de serviço.
- **POST /api/execucaoservico/:execucaoId/selo**
  - Faz upload de selo eletrônico para uma execução.
- **GET /api/execucao-servico/:execucaoId/selos**
  - Lista selos de uma execução.
- **DELETE /api/execucao-servico/:execucaoId/selo/:seloId**
  - Remove um selo de uma execução.

## Admin/Render/Postgres (Backup e Exportação)
- **GET /api/admin/render/services**
  - Lista serviços do Render.
- **POST /api/admin/render/services/:serviceId/backup**
  - Cria backup de um serviço no Render.
- **GET /api/admin/render/postgres**
  - Lista bancos Postgres do Render.
- **GET /api/admin/render/postgres/:postgresId/exports**
  - Lista exports de um banco Postgres.
- **POST /api/admin/render/postgres/:postgresId/export**
  - Solicita exportação de um banco Postgres.
- **POST /admin/render/postgres/:postgresId/recovery**
  - Dispara backup automático (recovery) para um banco Postgres.

## Backup Agendado
- **GET /api/:postgresId/backup-agendado**
  - Busca configuração de backup agendado para um banco.
- **POST /api/:postgresId/backup-agendado**
  - Cria ou atualiza configuração de backup agendado.
