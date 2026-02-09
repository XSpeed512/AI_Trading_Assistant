<?php
session_start();
require_once("../config/db_connect.php");
require_once("../includes/functions.php");
include('../includes/header.php');
?>
<h1>Dashboard Amministratore</h1>

<div class="stats">
    <p>Utenti registrati: <?php echo currentUserId($conn); ?></p>
</div>

<hr>

<!-- INIZIO PARTE API -->
<?php
/*
if (!empty($openai_api_key)) {
    // Esempio di richiesta API (commentata per ora)
    $prompt = "Dammi un riepilogo sull'andamento del mercato oggi";
    $model = "gpt-4";
    $response = callOpenAI($openai_api_key, $model, $prompt);

    if ($response) {
        echo "<h3>Risposta AI:</h3>";
        echo "<pre>" . htmlspecialchars($response) . "</pre>";
    } else {
        echo "<p>Nessuna risposta dall'AI</p>";
    }
}
*/
?>
<!-- FINE PARTE API -->
<div class="container">
    <h1>Dashboard Amministratore</h1>

    <h2>Statistiche Generali</h2>
    <p>Numero utenti registrati: <?php /*echo getTotalUsers($conn);*/ ?></p>
    <p>Numero richieste AI generate: 
        <?php 
        // INIZIO PARTE API (commentata)
        // echo getTotalAIGenerations($conn);
        // FINE PARTE API
        echo "Funzione API disattivata per il momento"; 
        ?>
    </p>
</div>
// Recupera tutti gli utenti
$users = getUsersId($conn);
?>

<h1>Gestione Utenti</h1>

<table border="1">
    <tr>
        <th>ID</th>
        <th>Username</th>
        <th>Email</th>
        <th>Ruolo</th>
        <th>Azioni</th>
    </tr>
    <?php foreach ($users as $user): ?>
        <tr>
            <td><?php echo $user['id']; ?></td>
            <td><?php echo htmlspecialchars($user['username']); ?></td>
            <td><?php echo htmlspecialchars($user['email']); ?></td>
            <td><?php echo $user['role']; ?></td>
            <td>
                <a href="edit_user.php?id=<?php echo $user['id']; ?>">Modifica</a> |
                <a href="delete_user.php?id=<?php echo $user['id']; ?>" onclick="return confirm('Eliminare questo utente?');">Elimina</a> |
                <a href="upgrade_premium.php?id=<?php echo $user['id']; ?>">Rendi Premium</a>
            </td>
        </tr>
    <?php endforeach; ?>
</table>

// Eliminazione utente
if (isset($_GET['delete'])) {
    $id = intval($_GET['delete']);
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    echo "<p>Utente eliminato con successo.</p>";
}
?>

<div class="container">
    <h1>Gestione Utenti</h1>
    <table border="1" cellpadding="8">
        <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Email</th>
            <th>Ruolo</th>
            <th>Azioni</th>
        </tr>
        <?php
        $result = $conn->query("SELECT * FROM users");
        while ($row = $result->fetch_assoc()) {
            echo "<tr>
                    <td>{$row['id']}</td>
                    <td>{$row['username']}</td>
                    <td>{$row['email']}</td>
                    <td>{$row['role']}</td>
                    <td>
                        <a href='?delete={$row['id']}' onclick=\"return confirm('Eliminare questo utente?')\">Elimina</a>
                    </td>
                </tr>";
        }
        ?>
    </table>
</div>

// Salvataggio impostazioni
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $api_key = trim($_POST['openai_api_key']);
    $model = trim($_POST['model']);

    // Qui potresti salvare su DB o file di configurazione
    saveSettings($conn, $api_key, $model);
    echo "<p>Impostazioni salvate con successo!</p>";
}

// Recupero impostazioni attuali
$settings = getSettings($conn);
?>

<h1>Impostazioni AI</h1>

<form method="post">
    <label>OpenAI API Key:</label><br>
    <input type="text" name="openai_api_key" value="<?php echo htmlspecialchars($settings['openai_api_key'] ?? ''); ?>"><br><br>

    <label>Modello AI:</label><br>
    <select name="model">
        <option value="gpt-4" <?php if(($settings['model'] ?? '') === 'gpt-4') echo 'selected'; ?>>GPT-4</option>
        <option value="gpt-3.5-turbo" <?php if(($settings['model'] ?? '') === 'gpt-3.5-turbo') echo 'selected'; ?>>GPT-3.5 Turbo</option>
    </select><br><br>

    <button type="submit">Salva</button>
</form>

<hr>

<!-- INIZIO PARTE API -->
<?php
/*
if (!empty($settings['openai_api_key'])) {
    echo "<h3>Test connessione AI:</h3>";
    $test_prompt = "Ciao AI, rispondi con 'OK' se la connessione funziona";
    $response = callOpenAI($settings['openai_api_key'], $settings['model'], $test_prompt);

    if ($response) {
        echo "<pre>" . htmlspecialchars($response) . "</pre>";
    } else {
        echo "<p>Errore nella connessione all'AI</p>";
    }
}
*/


// Salvataggio impostazioni
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $site_name = $_POST['site_name'];
    $ai_model = $_POST['ai_model'];

    // Salva nel DB
    $stmt = $conn->prepare("UPDATE settings SET site_name = ?, ai_model = ? WHERE id = 1");
    $stmt->bind_param("ss", $site_name, $ai_model);
    $stmt->execute();
    echo "<p>Impostazioni aggiornate.</p>";
}

// Carica impostazioni attuali
$result = $conn->query("SELECT * FROM settings WHERE id = 1");
$settings = $result->fetch_assoc();
?>

<div class="container">
    <h1>Impostazioni del Sistema</h1>
    <form method="POST">
        <label>Nome del sito:</label>
        <input type="text" name="site_name" value="<?php echo $settings['site_name']; ?>" required>

        <label>Modello AI:</label>
        <select name="ai_model">
            <!-- INIZIO PARTE API -->
            <!-- Opzioni future da caricare dinamicamente da API -->
            <!-- Esempio futuro: 
            <?php
            // $models = getAvailableAIModels();
            // foreach ($models as $model) {
            //     echo "<option value='$model'>$model</option>";
            // }
            ?> 
            -->
            <!-- FINE PARTE API -->
            <option value="gpt-4" <?php if($settings['ai_model'] === "gpt-4") echo "selected"; ?>>GPT-4</option>
            <option value="gpt-3.5" <?php if($settings['ai_model'] === "gpt-3.5") echo "selected"; ?>>GPT-3.5</option>
        </select>

        <button type="submit">Salva Impostazioni</button>
    </form>
</div>

$error = "";
$search = isset($_GET['search']) ? trim($_GET['search']) : "";

// Eliminazione record
if (isset($_GET['delete']) && is_numeric($_GET['delete'])) {
    $deleteId = intval($_GET['delete']);
    try {
        $stmt = $conn->prepare("DELETE FROM signals WHERE id = :id");
        $stmt->execute([":id" => $deleteId]);
        header("Location: admin_history.php");
        exit();
    } catch (PDOException $e) {
        $error = "Errore durante l'eliminazione del segnale.";
    }
}

// Recupero segnali di tutti gli utenti
try {
    if ($search) {
        $stmt = $conn->prepare("SELECT s.*, u.username 
                                FROM signals s
                                JOIN users u ON s.user_id = u.id
                                WHERE (s.prompt LIKE :search OR s.response LIKE :search OR u.username LIKE :search)
                                ORDER BY s.created_at DESC");
        $stmt->execute([":search" => "%$search%"]);
    } else {
        $stmt = $conn->prepare("SELECT s.*, u.username 
                                FROM signals s
                                JOIN users u ON s.user_id = u.id
                                ORDER BY s.created_at DESC");
        $stmt->execute();
    }
    $signals = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    $error = "Errore durante il recupero della cronologia.";
    $signals = [];
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cronologia Admin - Segnali AI</title>
    <link rel="stylesheet" href="../css/style.css">
    <style>
        .history-container { max-width: 1200px; margin: auto; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #222; color: #fff; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .delete-btn { color: red; text-decoration: none; font-weight: bold; }
        .search-box { margin-bottom: 15px; display: flex; gap: 10px; }
        .search-box input { flex: 1; padding: 8px; }
        .search-box button { padding: 8px 15px; }
        .username-cell { font-weight: bold; color: #0056b3; }
    </style>
</head>
<body>

<?php include("../includes/header.php"); ?>

<div class="history-container">
    <h1>📊 Cronologia Completa Segnali AI (Admin)</h1>

    <!-- Barra ricerca -->
    <form method="get" class="search-box">
        <input type="text" name="search" placeholder="Cerca per username, prompt o risposta..." value="<?= htmlspecialchars($search) ?>">
        <button type="submit">🔍 Cerca</button>
        <a href="admin_history.php" class="btn-reset">❌ Reset</a>
    </form>

    <?php if ($error): ?>
        <p class="error-msg"><?= $error ?></p>
    <?php endif; ?>

    <?php if (count($signals) > 0): ?>
        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Utente</th>
                    <th>Prompt</th>
                    <th>Risposta AI</th>
                    <th>Azioni</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($signals as $row): ?>
                    <tr>
                        <td><?= htmlspecialchars($row['created_at']) ?></td>
                        <td class="username-cell"><?= htmlspecialchars($row['username']) ?></td>
                        <td><?= nl2br(htmlspecialchars($row['prompt'])) ?></td>
                        <td><?= nl2br(htmlspecialchars($row['response'])) ?></td>
                        <td>
                            <a class="delete-btn" href="admin_history.php?delete=<?= $row['id'] ?>" onclick="return confirm('Sei sicuro di voler eliminare questo segnale?')">🗑 Elimina</a>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php else: ?>
        <p>Nessun segnale trovato.</p>
    <?php endif; ?>

    <p><a href="analyze.php">⬅ Torna alla Generazione</a></p>
</div>
</body>
</html>
<?php include("../includes/footer.php"); ?>



