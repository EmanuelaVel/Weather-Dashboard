// Weather Dashboard - previsioni meteo con Node.js e Open-Meteo

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// File dove vengono salvate le città preferite
const FAVORITES_FILE = path.join(__dirname, 'cities.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Fa una domanda all'utente e restituisce la risposta
function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Città selezionata con l'ultima ricerca
let currentCity = null;

// Cronologia delle ricerche (resta in memoria finché il programma è aperto)
const searchHistory = [];


// =========================
// CODICI METEO
// =========================

// Trasforma il codice meteo dell'API in una descrizione
function getWeatherDescription(code) {
    if (code === 0) return 'Sereno';
    if (code === 1 || code === 2) return 'Poco nuvoloso';
    if (code === 3) return 'Nuvoloso';
    if (code === 45 || code === 48) return 'Nebbia';
    if (code >= 51 && code <= 57) return 'Pioggerella';
    if (code >= 61 && code <= 67) return 'Pioggia';
    if (code >= 71 && code <= 77) return 'Neve';
    if (code >= 80 && code <= 82) return 'Rovesci di pioggia';
    if (code === 85 || code === 86) return 'Rovesci di neve';
    if (code >= 95) return 'Temporale';
    return 'Sconosciuto';
}


// =========================
// PARTE B - RICERCA CITTÀ
// =========================

async function searchCity(cityName) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=it&format=json`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Errore nella richiesta alla Geocoding API: ' + response.status);
    }
    const data = await response.json();

    // Se non ci sono risultati la città non esiste
    if (!data.results || data.results.length === 0) {
        console.log('Nessuna città trovata con questo nome.');
        return null;
    }

    // Mostro le città trovate (possono esserci città con lo stesso nome in Paesi diversi)
    console.log('\nCittà trovate:');
    data.results.forEach((city, index) => {
        const region = city.admin1 ? city.admin1 : 'N/D';
        console.log(`${index + 1}. ${city.name} - ${region} (${city.country})`);
    });

    // L'utente sceglie quella corretta
    const choice = Number(await ask('Scegli il numero della città: '));
    if (!Number.isInteger(choice) || choice < 1 || choice > data.results.length) {
        console.log('Scelta non valida.');
        return null;
    }

    const selected = data.results[choice - 1];
    return {
        name: selected.name,
        country: selected.country,
        region: selected.admin1 ? selected.admin1 : 'N/D',
        latitude: selected.latitude,
        longitude: selected.longitude
    };
}


// =========================
// PARTE C - METEO ATTUALE
// =========================

async function getCurrentWeather(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Errore nella richiesta alla Weather API: ' + response.status);
    }
    const data = await response.json();
    return data.current;
}


// =========================
// PARTE D - PREVISIONI
// =========================

async function getWeatherForecast(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Errore nella richiesta alla Weather API: ' + response.status);
    }
    const data = await response.json();
    return data.daily;
}


// =========================
// PARTE E - CITTÀ PREFERITE
// =========================

// Legge le città preferite dal file cities.json
function loadFavorites() {
    if (!fs.existsSync(FAVORITES_FILE)) {
        return [];
    }
    const content = fs.readFileSync(FAVORITES_FILE, 'utf-8');
    // Se il file è vuoto non c'è ancora nessun preferito
    if (content.trim() === '') {
        return [];
    }
    return JSON.parse(content);
}

// Salva le città preferite nel file cities.json
function saveFavorites(favorites) {
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 4));
}


// =========================
// OPERAZIONI DEL MENU
// =========================

async function handleSearch() {
    const cityName = await ask('Inserisci il nome della città: ');
    if (cityName === '') {
        console.log('Devi inserire il nome di una città.');
        return;
    }

    const city = await searchCity(cityName);
    if (city) {
        currentCity = city;
        searchHistory.push(`${city.name} (${city.country})`);
        console.log('\nCittà selezionata:');
        console.log(`Nome: ${city.name}`);
        console.log(`Paese: ${city.country}`);
        console.log(`Regione: ${city.region}`);
        console.log(`Latitudine: ${city.latitude}`);
        console.log(`Longitudine: ${city.longitude}`);
    }
}

async function showCurrentWeather() {
    if (!currentCity) {
        console.log('Prima cerca una città (opzione 1).');
        return;
    }

    const current = await getCurrentWeather(currentCity.latitude, currentCity.longitude);

    console.log('================================');
    console.log('          METEO ATTUALE');
    console.log('================================');
    console.log(`Città: ${currentCity.name}`);
    console.log(`Temperatura: ${Math.round(current.temperature_2m)} °C`);
    console.log(`Temperatura percepita: ${Math.round(current.apparent_temperature)} °C`);
    console.log(`Umidità: ${current.relative_humidity_2m}%`);
    console.log(`Vento: ${Math.round(current.wind_speed_10m)} km/h`);
    console.log(`Condizioni: ${getWeatherDescription(current.weather_code)}`);
    console.log(`Momento: ${current.is_day === 1 ? 'Giorno' : 'Notte'}`);
    console.log('================================');
}

async function showForecast() {
    if (!currentCity) {
        console.log('Prima cerca una città (opzione 1).');
        return;
    }

    const daily = await getWeatherForecast(currentCity.latitude, currentCity.longitude);

    console.log('================================');
    console.log(`  PREVISIONI - ${currentCity.name}`);
    console.log('================================');

    // I dati sono in array paralleli: lo stesso indice corrisponde allo stesso giorno
    for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]).toLocaleDateString('it-IT', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        console.log(`Data: ${date}`);
        console.log(`Minima: ${Math.round(daily.temperature_2m_min[i])} °C`);
        console.log(`Massima: ${Math.round(daily.temperature_2m_max[i])} °C`);
        console.log(`Probabilità pioggia: ${daily.precipitation_probability_max[i]}%`);
        console.log(`Condizioni: ${getWeatherDescription(daily.weather_code[i])}`);
        console.log('--------------------------------');
    }
}

function showFavorites() {
    const favorites = loadFavorites();
    if (favorites.length === 0) {
        console.log('Non hai ancora città preferite.');
        return;
    }

    console.log('\nCittà preferite:');
    favorites.forEach((city, index) => {
        console.log(`${index + 1}. ${city.name} - ${city.region} (${city.country}) - lat: ${city.latitude}, lon: ${city.longitude}`);
    });
}

function addFavorite() {
    if (!currentCity) {
        console.log('Prima cerca una città (opzione 1).');
        return;
    }

    const favorites = loadFavorites();

    // Controllo che la città non sia già tra i preferiti
    const alreadySaved = favorites.some((city) =>
        city.name === currentCity.name && city.country === currentCity.country
    );
    if (alreadySaved) {
        console.log(`${currentCity.name} è già tra i preferiti.`);
        return;
    }

    favorites.push(currentCity);
    saveFavorites(favorites);
    console.log(`${currentCity.name} aggiunta ai preferiti.`);
}

function showHistory() {
    if (searchHistory.length === 0) {
        console.log('Nessuna ricerca effettuata.');
        return;
    }

    console.log('\nCronologia ricerche:');
    searchHistory.forEach((city, index) => {
        console.log(`${index + 1}. ${city}`);
    });
}


// =========================
// PARTE A - MENU PRINCIPALE
// =========================

function showMenu() {
    console.log('\n================================');
    console.log('       WEATHER DASHBOARD');
    console.log('================================');
    console.log('1. Cerca una città');
    console.log('2. Visualizza meteo attuale');
    console.log('3. Visualizza previsioni settimanali');
    console.log('4. Visualizza città preferite');
    console.log('5. Aggiungi città ai preferiti');
    console.log('6. Visualizza cronologia ricerche');
    console.log('7. Esci');
}

async function main() {
    let running = true;

    while (running) {
        showMenu();
        const option = await ask("Seleziona un'opzione: ");

        try {
            switch (option) {
                case '1':
                    await handleSearch();
                    break;
                case '2':
                    await showCurrentWeather();
                    break;
                case '3':
                    await showForecast();
                    break;
                case '4':
                    showFavorites();
                    break;
                case '5':
                    addFavorite();
                    break;
                case '6':
                    showHistory();
                    break;
                case '7':
                    running = false;
                    break;
                default:
                    console.log('Opzione non valida. Inserisci un numero da 1 a 7.');
            }
        } catch (error) {
            console.log('Si è verificato un errore: ' + error.message);
        }

        // Torno al menu principale dopo ogni operazione
        if (running) {
            await ask('\nPremi Invio per tornare al menu...');
        }
    }

    console.log('Arrivederci!');
    rl.close();
}

main();
