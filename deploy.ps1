# Script de déploiement manuel pour Google Cloud Run
# Ce script déploie directement depuis votre code local

# IMPORTANT: Remplacez VOTRE_PROJECT_ID par votre vrai ID de projet Google Cloud
# Vous pouvez le trouver ici: https://console.cloud.google.com/home/dashboard

$PROJECT_ID = "VOTRE_PROJECT_ID"  # À REMPLACER !
$SERVICE_NAME = "adt-extracteur-de-donnees-tabulaires"
$REGION = "us-west1"

Write-Host "🚀 Déploiement de l'application ADT sur Google Cloud Run..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si gcloud est installé
try {
    gcloud --version | Out-Null
    Write-Host "✅ gcloud CLI détecté" -ForegroundColor Green
} catch {
    Write-Host "❌ gcloud CLI n'est pas installé" -ForegroundColor Red
    Write-Host ""
    Write-Host "Veuillez installer gcloud CLI depuis:" -ForegroundColor Yellow
    Write-Host "https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Après installation, exécutez:" -ForegroundColor Yellow
    Write-Host "  gcloud auth login" -ForegroundColor Cyan
    Write-Host "  gcloud config set project $PROJECT_ID" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "📦 Déploiement en cours..." -ForegroundColor Yellow
Write-Host ""

# Déployer sur Cloud Run
gcloud run deploy $SERVICE_NAME `
    --source . `
    --platform managed `
    --region $REGION `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --max-instances 10 `
    --min-instances 0 `
    --timeout 300

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Déploiement réussi!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Votre application est accessible à:" -ForegroundColor Cyan
    gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'
} else {
    Write-Host ""
    Write-Host "❌ Le déploiement a échoué" -ForegroundColor Red
    Write-Host "Vérifiez les erreurs ci-dessus" -ForegroundColor Yellow
}
