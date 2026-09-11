  // ---------- SELECCIONAR HORARIOS ----------
  const TIME_SLOTS = ["08:00 - 10:00", "10:00 - 12:00", "13:00 - 15:00", "15:00 - 17:00", "17:00 - 19:00", "19:00 - 21:00"];
  const WEEKDAYS_START_MONDAY = true;

  let today = new Date();
  today.setHours(0,0,0,0);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // VER MES ACTUAL

  let selectedRoomName = null;
  let selectedDateISO = null; // AÑO-MES-DIA
  let selectedSlot = null;

  // Reservas 
  const reservations = [
    { room: "Aula 101", date: isoDate(new Date(viewYear, viewMonth, addDaysClamp(2))), slot: "10:00 - 12:00" },
    { room: "Laboratorio 103", date: isoDate(new Date(viewYear, viewMonth, addDaysClamp(2))), slot: "14:00 - 16:00" },
    { room: "Aula 105", date: isoDate(new Date(viewYear, viewMonth, addDaysClamp(5))), slot: "08:00 - 10:00" },
  ];

  function addDaysClamp(n){
    const d = today.getDate() + n;
    return d;
  }

  function isoDate(d){
    return d.toISOString().slice(0,10);
  }

  const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  // ---------- SELECCIONAR AULA ----------
  function selectRoom(el){
    document.querySelectorAll('.room').forEach(r => r.classList.remove('selected'));
    el.classList.add('selected');
    selectedRoomName = el.getAttribute('data-room');
    const cap = el.getAttribute('data-cap');
    document.getElementById('selected-room-tag').textContent = `Seleccionada: ${selectedRoomName} — ${cap}`;
    renderSlots();
    updateConfirmBar();
  }

  // ---------- RENDERIZA CALENDARIO  ----------
  function renderCalendar(){
    document.getElementById('cal-month-label').textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
    const daysContainer = document.getElementById('cal-days');
    daysContainer.innerHTML = '';

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    let startWeekday = firstOfMonth.getDay(); // 0=Sun
    if(WEEKDAYS_START_MONDAY){ startWeekday = (startWeekday + 6) % 7; } // shift so Monday=0

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    for(let i=0; i<startWeekday; i++){
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      daysContainer.appendChild(empty);
    }

    for(let day=1; day<=daysInMonth; day++){
      const cellDate = new Date(viewYear, viewMonth, day);
      cellDate.setHours(0,0,0,0);
      const iso = isoDate(cellDate);

      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = day;

      if(cellDate.getTime() === today.getTime()) cell.classList.add('today');

      if(cellDate < today){
        cell.classList.add('past');
      } else {
        cell.onclick = () => {
          document.querySelectorAll('.cal-day').forEach(c => c.classList.remove('selected'));
          cell.classList.add('selected');
          selectedDateISO = iso;
          renderSlots();
          updateConfirmBar();
        };
      }

      if(iso === selectedDateISO) cell.classList.add('selected');

      daysContainer.appendChild(cell);
    }
  }

  function changeMonth(delta){
    viewMonth += delta;
    if(viewMonth < 0){ viewMonth = 11; viewYear--; }
    if(viewMonth > 11){ viewMonth = 0; viewYear++; }
    renderCalendar();
  }

  // ---------- SLOTS ----------
  function renderSlots(){
    const list = document.getElementById('slot-list');
    list.innerHTML = '';

    if(!selectedRoomName || !selectedDateISO){
      const msg = document.createElement('div');
      msg.className = 'hint';
      msg.style.marginTop = '0';
      msg.textContent = 'Elegí primero un aula y una fecha para ver la disponibilidad.';
      list.appendChild(msg);
      return;
    }

    TIME_SLOTS.forEach(slot => {
      const occupied = reservations.some(r =>
        r.room === selectedRoomName && r.date === selectedDateISO && r.slot === slot
      );

      const row = document.createElement('div');
      row.className = 'slot ' + (occupied ? 'occupied' : 'free') + (slot === selectedSlot ? ' selected' : '');

      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = slot;

      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = occupied ? 'Ocupado' : (slot === selectedSlot ? 'Elegido' : 'Libre');

      row.appendChild(time);
      row.appendChild(tag);

      if(!occupied){
        row.onclick = () => {
          selectedSlot = (selectedSlot === slot) ? null : slot;
          renderSlots();
          updateConfirmBar();
        };
      }

      list.appendChild(row);
    });
  }

  // ---------- CONFIRMA ----------
  function updateConfirmBar(){
    const summary = document.getElementById('confirm-summary');
    const btn = document.getElementById('confirm-btn');

    if(selectedRoomName && selectedDateISO && selectedSlot){
      const [y,m,d] = selectedDateISO.split('-');
      summary.innerHTML = `<b>${selectedRoomName}</b> · ${d}/${m}/${y} · <b>${selectedSlot}</b>`;
      btn.disabled = false;
    } else {
      const parts = [];
      if(!selectedRoomName) parts.push('un aula');
      if(!selectedDateISO) parts.push('una fecha');
      if(!selectedSlot) parts.push('un horario');
      summary.textContent = `Falta elegir: ${parts.join(', ')}.`;
      btn.disabled = true;
    }
  }

  function confirmBooking(){
    if(!selectedRoomName || !selectedDateISO || !selectedSlot) return;

    reservations.push({ room: selectedRoomName, date: selectedDateISO, slot: selectedSlot });

    const toast = document.getElementById('toast');
    toast.textContent = `Reserva confirmada: ${selectedRoomName} ✓`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);

    selectedSlot = null;
    renderSlots();
    updateConfirmBar();
  }

  // ---------- INICIA FUNCIONES ----------
  renderCalendar();
  updateConfirmBar();
