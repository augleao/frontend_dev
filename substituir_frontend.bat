@echo off
echo ========================================
echo Substituindo conteudo do frontend pelo frontend_dev
echo ========================================
echo.

REM Verificar se estamos em um repositorio Git
if not exist ".git" (
    echo ERRO: Este diretorio nao e um repositorio Git!
    echo Certifique-se de executar este script dentro do repositorio frontend
    exit /b 1
)

echo Passo 1: Adicionando repositorio frontend_dev como remoto temporario...
git remote add devrepo https://github.com/augleao/frontend_dev.git
if %errorlevel% neq 0 (
    echo Remoto ja existe ou erro ao adicionar. Continuando...
)

echo.
echo Passo 2: Buscando conteudo do frontend_dev...
git fetch devrepo
if %errorlevel% neq 0 (
    echo ERRO: Falha ao buscar conteudo do frontend_dev
    pause
    exit /b 1
)

echo.
echo Passo 3: Substituindo conteudo atual pelo do frontend_dev...


git reset --hard devrepo/main
if %errorlevel% neq 0 (
    echo ERRO: Falha ao substituir conteudo
    exit /b 1
)

echo.
echo Passo 4: Enviando alteracoes para o repositorio frontend remoto...


git push origin main --force
if %errorlevel% neq 0 (
    echo ERRO: Falha ao enviar alteracoes
    exit /b 1
)

echo.
echo Passo 5: Removendo remoto temporario...
git remote remove devrepo

echo.
echo ========================================
echo SUCESSO! Conteudo substituido com sucesso!
echo O repositorio frontend agora tem o mesmo conteudo do frontend_dev
echo ========================================
