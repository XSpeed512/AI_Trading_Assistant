<?php
session_start();
include('../includes/header.php');
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Accesso Utente</title>
  <link rel="stylesheet" href="../css/login.css">
  <!-- Font Awesome per icone -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
</head>
<body>

<header>
  <div class="container">
      <h1>🔐 Area Riservata</h1>
  </div>
  <div class="icon">
      <a href="../index.php" title="Home"><i class="fa-solid fa-house"></i></a>
   </div>
</header>

<main class="page-wrap">
  <form class="form-card" action="../auth/login_process.php" method="post">
    <h2 class="form-title">Accedi</h2>
    <p class="form-subtitle">Bentornato! Inserisci le tue credenziali.</p>

    <?php if (isset($_SESSION['error'])): ?>
      <div class="error"><?= $_SESSION['error']; unset($_SESSION['error']); ?></div>
    <?php endif; ?>

    <div class="form-row">
      <span class="input-icon"><i class="fa-solid fa-envelope"></i></span>
      <input class="input" type="email" name="email" id="email" placeholder="Email" required>
    </div>

    <div class="form-row">
      <span class="input-icon"><i class="fa-solid fa-lock"></i></span>
      <input class="input" type="password" name="password" id="password" placeholder="Password" required>
      <span class="input-append">
        <button type="button" id="togglePass" aria-label="Mostra/Nascondi Password"><i class="fa-regular fa-eye"></i></button>
      </span>
    </div>

    <button type="submit" class="btn" style="width:100%;justify-content:center;">Accedi</button>

    <div class="form-links">
      <p>Non hai un account? <a href="../auth/register.php">Registrati</a></p>
    </div>
  </form>
</main>

<footer>
  <p>&copy; <?= date('Y'); ?> AI Trading Assistant - Tutti i diritti riservati</p>
</footer>

<script>
  // Toggle password (mostra/nascondi)
  const pass = document.getElementById('password');
  const toggle = document.getElementById('togglePass');
  toggle.addEventListener('click', () => {
    const show = pass.getAttribute('type') === 'password';
    pass.setAttribute('type', show ? 'text' : 'password');
    toggle.innerHTML = show ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
  });
</script>
</body>
</html>
