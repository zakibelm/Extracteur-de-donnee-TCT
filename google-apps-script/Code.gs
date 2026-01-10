/**
 * Google Apps Script pour ADT - Extractions TCT
 * Déployé sur: zakibelm66@gmail.com
 * 
 * Ce script reçoit les tableaux consolidés depuis l'application
 * et les enregistre dans Google Sheets pour archivage permanent.
 */

// ID du Google Sheet (à créer manuellement)
const SHEET_ID = 'VOTRE_SHEET_ID_ICI'; // À remplacer après création du Sheet

// Nom des feuilles
const EXTRACTIONS_SHEET = 'Extractions';
const USERS_SHEET = 'Users';

/**
 * Fonction appelée par l'application pour sauvegarder un tableau consolidé
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'save_consolidated') {
      return saveConsolidatedTable(data);
    } else if (action === 'save_user') {
      return saveUser(data);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Action non reconnue'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Erreur doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Sauvegarde un tableau consolidé dans Google Sheets
 */
function saveConsolidatedTable(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(EXTRACTIONS_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(EXTRACTIONS_SHEET);
    // En-têtes
    const headers = ['Timestamp', 'User', 'NumDome', ...data.headers];
    sheet.appendRow(headers);
  }

  // Ajouter chaque ligne du tableau consolidé
  const timestamp = new Date();
  data.rows.forEach(row => {
    const fullRow = [
      timestamp,
      data.userEmail || data.numDome,
      data.numDome,
      ...row
    ];
    sheet.appendRow(fullRow);
  });

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    rowsAdded: data.rows.length,
    timestamp: timestamp
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Sauvegarde un utilisateur (backup)
 */
function saveUser(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(USERS_SHEET);
  
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET);
    sheet.appendRow(['Timestamp', 'NumDome', 'IdEmploye', 'Email', 'Telephone', 'IsAdmin']);
  }

  sheet.appendRow([
    new Date(),
    data.numDome,
    data.idEmploye,
    data.email || '',
    data.telephone || '',
    data.isAdmin || false
  ]);

  return ContentService.createTextOutput(JSON.stringify({
    success: true
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fonction GET pour récupérer les données (optionnel)
 */
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'get_extractions') {
    return getExtractions(e.parameter.numDome);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Action non reconnue'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Récupère les extractions d'un utilisateur
 */
function getExtractions(numDome) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(EXTRACTIONS_SHEET);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      extractions: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  // Filtrer par numDome si fourni
  const filteredRows = numDome 
    ? rows.filter(row => row[2] === numDome)
    : rows;

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    extractions: filteredRows.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    })
  })).setMimeType(ContentService.MimeType.JSON);
}
