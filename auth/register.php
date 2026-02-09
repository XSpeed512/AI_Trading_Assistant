<?php
session_start();
include('../includes/header.php');
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Registrazione</title>
  <link rel="stylesheet" href="../css/register.css">
  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
</head>
<body>

<header>
  <div class="container">
      <h1>📝 Crea un Account</h1>
  </div>
  <div class="icon">
      <a href="../index.php" title="Home"><i class="fa-solid fa-house"></i></a>
   </div>
</header>

<main class="page-wrap">
  <form class="form-card" action="register_process.php" method="post">
    <h2 class="form-title">Registrati</h2>
    <p class="form-subtitle">Crea il tuo profilo per iniziare.</p>

    <?php if (isset($_SESSION['error'])): ?>
      <div class="error"><?= $_SESSION['error']; unset($_SESSION['error']); ?></div>
    <?php endif; ?>
    <?php if (isset($_SESSION['success'])): ?>
      <div class="success"><?= $_SESSION['success']; unset($_SESSION['success']); ?></div>
    <?php endif; ?>

    <div class="form-row">
      <span class="input-icon"><i class="fa-solid fa-user"></i></span>
      <input class="input" type="text" name="username" id="username" placeholder="Nome utente" required>
    </div>

    <div class="form-row">
      <span class="input-icon"><i class="fa-solid fa-envelope"></i></span>
      <input class="input" type="email" name="email" id="email" placeholder="Email" required>
    </div>

    <div class="form-2col">
      <div class="form-row">
        <span class="input-icon"><i class="fa-solid fa-lock"></i></span>
        <input class="input" type="password" name="password" id="password" placeholder="Password" required>
        <span class="input-append">
          <button type="button" id="togglePass"><i class="fa-regular fa-eye"></i></button>
        </span>
      </div>

      <div class="form-row">
        <span class="input-icon"><i class="fa-solid fa-lock"></i></span>
        <input class="input" type="password" name="confirm_password" id="confirm_password" placeholder="Conferma password" required>
        <span class="input-append">
          <button type="button" id="togglePass2"><i class="fa-regular fa-eye"></i></button>
        </span>
      </div>
    </div>

    <button type="submit" class="btn" style="width:100%;justify-content:center;">Crea account</button>

    <div class="form-links">
      <p>Hai già un account?<a href="../auth/login.php"> Accedi</a></p>
    </div>
  </form>
</main>

<footer>
  <p>&copy; <?= date('Y'); ?> AI Trading Assistant - Tutti i diritti riservati</p>
</footer>

<script>
  // toggles
  function attachToggle(btnId, inputId){
    const btn = document.getElementById(btnId);
    const inp = document.getElementById(inputId);
    btn.addEventListener('click', ()=>{
      const show = inp.getAttribute('type') === 'password';
      inp.setAttribute('type', show ? 'text' : 'password');
      btn.innerHTML = show ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
  }
  attachToggle('togglePass','password');
  attachToggle('togglePass2','confirm_password');
</script>
</body>
</html>
