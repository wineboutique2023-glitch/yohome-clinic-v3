import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import "./styles.css";

const emptyClient = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  date_of_birth: "",
  suburb_area: "",
  emergency_contact: "",
  notes: "",
};

const emptyIntake = {
  main_concern: "",
  pain_area: "",
  pain_level: "",
  medical_history: "",
  medications: "",
  allergies: "",
  contraindications: "",
  consent_given: false,
  signature_name: "",
  signature_date: "",
  signature_image: "",
  body_chart_notes: "",
  body_chart_image: "",
  risk_alerts: "",
};

const emptySoap = {
  treatment_date: "",
  therapist_name: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  therapist_notes: "",
};

export default function App() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [intakeForm, setIntakeForm] = useState(emptyIntake);
  const [intakeHistory, setIntakeHistory] = useState([]);
  const [soapForm, setSoapForm] = useState(emptySoap);
  const [soapNotes, setSoapNotes] = useState([]);
  const [activeTab, setActiveTab] = useState("client");
  const [loading, setLoading] = useState(false);
  const [therapists, setTherapists] = useState([]);
  const [newTherapist, setNewTherapist] = useState("");

  const signatureRef = useRef(null);
  const bodyChartRef = useRef(null);
  const isSigningRef = useRef(false);
  const isDrawingBodyRef = useRef(false);

  useEffect(() => {
    fetchClients();
    fetchTherapists();
  }, []);

  useEffect(() => {
    if (activeTab !== "intake") return;

    setTimeout(() => {
      restoreSignatureCanvas();
      restoreBodyChartCanvas();
    }, 100);
  }, [activeTab, selectedClient, intakeForm.signature_image, intakeForm.body_chart_image]);

  async function fetchTherapists() {
    const { data, error } = await supabase
      .from("therapists")
      .select("*")
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setTherapists(data || []);
  }

  async function addTherapist() {
    const name = newTherapist.trim();
    if (!name) return;

    const { error } = await supabase.from("therapists").insert([{ name }]);
    if (error) return alert(error.message);

    setNewTherapist("");
    await fetchTherapists();
  }

  async function deleteTherapist(id) {
    if (!window.confirm("Delete this therapist?")) return;

    const { error } = await supabase.from("therapists").delete().eq("id", id);
    if (error) return alert(error.message);

    await fetchTherapists();
  }

  async function fetchClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setClients(data || []);
  }

  async function selectClient(client) {
    setSelectedClient(client);
    setClientForm(client);
    setActiveTab("client");
    await fetchIntake(client.id);
    await fetchIntakeHistory(client.id);
    await fetchSoapNotes(client.id);
  }

  async function fetchIntake(clientId) {
    // Safe version:
    // Supabase .single() / .maybeSingle() will break if the same client accidentally has
    // more than one intake record. This always takes the latest one instead.
    const { data, error } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return alert(error.message);

    setIntakeForm({
      ...emptyIntake,
      ...(data && data.length > 0 ? data[0] : {}),
    });
  }

  async function fetchIntakeHistory(clientId) {
    const { data, error } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setIntakeHistory(data || []);
  }

  async function fetchSoapNotes(clientId) {
    const { data, error } = await supabase
      .from("soap_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setSoapNotes(data || []);
  }

  function handleClientChange(e) {
    setClientForm({ ...clientForm, [e.target.name]: e.target.value });
  }

  function handleIntakeChange(e) {
    const { name, value, type, checked } = e.target;
    setIntakeForm({
      ...intakeForm,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  function handleSoapChange(e) {
    setSoapForm({ ...soapForm, [e.target.name]: e.target.value });
  }

  async function saveNewClient() {
    if (!clientForm.first_name && !clientForm.last_name) {
      return alert("Please enter client name.");
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("clients")
      .insert([clientForm])
      .select()
      .single();

    setLoading(false);

    if (error) return alert(error.message);

    await fetchClients();
    await selectClient(data);
    alert("Client saved.");
  }

  async function updateClient() {
    if (!selectedClient) return alert("Please select a client first.");

    setLoading(true);

    const { error } = await supabase
      .from("clients")
      .update(clientForm)
      .eq("id", selectedClient.id);

    setLoading(false);

    if (error) return alert(error.message);

    await fetchClients();
    alert("Client updated.");
  }

  async function deleteClient() {
    if (!selectedClient) return alert("Please select a client first.");

    if (
      !window.confirm(
        "Are you sure you want to delete this client? This will also delete their intake and SOAP notes."
      )
    )
      return;

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", selectedClient.id);

    if (error) return alert(error.message);

    newClient();
    await fetchClients();
    alert("Client deleted.");
  }

  async function saveIntake() {
    if (!selectedClient) return alert("Please select a client first.");

    setLoading(true);

    const updatedIntake = {
      ...intakeForm,
      signature_image: signatureRef.current
        ? signatureRef.current.toDataURL("image/png")
        : intakeForm.signature_image,
      body_chart_image: bodyChartRef.current
        ? bodyChartRef.current.toDataURL("image/png")
        : intakeForm.body_chart_image,
      client_id: selectedClient.id,
    };

    // Important:
    // Intake is now saved as history. Every Save Intake creates a new record,
    // so old intake records can be viewed after refresh and will not be overwritten.
    delete updatedIntake.id;
    delete updatedIntake.created_at;
    delete updatedIntake.updated_at;

    const { data, error } = await supabase
      .from("intake_forms")
      .insert([updatedIntake])
      .select()
      .limit(1);

    setLoading(false);

    if (error) return alert(error.message);

    if (!data || data.length === 0) {
      return alert("Intake form may not have saved. Please check Supabase.");
    }

    await fetchIntake(selectedClient.id);
    await fetchIntakeHistory(selectedClient.id);
    alert("Intake form saved to history.");
  }

  async function saveSoapNote() {
    if (!selectedClient) return alert("Please select a client first.");

    const hasSoapContent =
      soapForm.subjective ||
      soapForm.objective ||
      soapForm.assessment ||
      soapForm.plan ||
      soapForm.therapist_notes;

    if (!hasSoapContent) {
      return alert("Please enter SOAP note details before saving.");
    }

    setLoading(true);

    const soapData = {
      ...soapForm,
      treatment_date:
        soapForm.treatment_date || new Date().toISOString().slice(0, 10),
      client_id: selectedClient.id,
    };

    // Do not send any accidental id/timestamp fields when inserting a new note.
    delete soapData.id;
    delete soapData.created_at;
    delete soapData.updated_at;

    const { data, error } = await supabase
      .from("soap_notes")
      .insert([soapData])
      .select()
      .limit(1);

    setLoading(false);

    if (error) return alert(error.message);

    if (!data || data.length === 0) {
      return alert("SOAP note may not have saved. Please check Supabase.");
    }

    setSoapForm(emptySoap);
    await fetchSoapNotes(selectedClient.id);
    alert("SOAP note saved.");
  }

  async function deleteSoapNote(id) {
    if (!window.confirm("Delete this SOAP note?")) return;

    const { error } = await supabase.from("soap_notes").delete().eq("id", id);
    if (error) return alert(error.message);

    await fetchSoapNotes(selectedClient.id);
  }

  function safeText(value) {
    return value || "Not recorded";
  }

  function loadIntakeFromHistory(record) {
    setIntakeForm({
      ...emptyIntake,
      ...(record || {}),
    });
    setTimeout(() => {
      restoreSignatureCanvas();
      restoreBodyChartCanvas();
    }, 100);
  }

  function cleanFileName(value) {
    return String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9\-_ ]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_");
  }

  function getClientFileName(label) {
    const today = new Date().toISOString().slice(0, 10);
    const firstName = selectedClient?.first_name || "Client";
    const lastName = selectedClient?.last_name || "";
    const clientName = cleanFileName(`${firstName} ${lastName}`) || "Client";
    return `YOHOME_${clientName}_${today}_${label}`;
  }

  function getCanvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startSignature(e) {
    e.preventDefault();
    const canvas = signatureRef.current;
    if (!canvas) return;

    isSigningRef.current = true;
    const ctx = canvas.getContext("2d");
    const point = getCanvasPoint(canvas, e);

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function drawSignature(e) {
    e.preventDefault();
    if (!isSigningRef.current) return;

    const canvas = signatureRef.current;
    const ctx = canvas.getContext("2d");
    const point = getCanvasPoint(canvas, e);

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#09223f";
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function stopSignature() {
    isSigningRef.current = false;

    const canvas = signatureRef.current;
    if (!canvas) return;

    setIntakeForm((prev) => ({
      ...prev,
      signature_image: canvas.toDataURL("image/png"),
    }));
  }

  function clearSignature() {
    const canvas = signatureRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    setIntakeForm((prev) => ({
      ...prev,
      signature_image: "",
    }));
  }

  function restoreSignatureCanvas() {
    const canvas = signatureRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!intakeForm.signature_image) return;

    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = intakeForm.signature_image;
  }

  function drawBodyTemplate() {
    const canvas = bodyChartRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#0f3d5e";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#09223f";
    ctx.font = "15px Arial";

    // Front body
    ctx.beginPath();
    ctx.arc(130, 55, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeRect(105, 85, 50, 95);

    ctx.beginPath();
    ctx.moveTo(105, 100);
    ctx.lineTo(70, 165);
    ctx.moveTo(155, 100);
    ctx.lineTo(190, 165);
    ctx.moveTo(115, 180);
    ctx.lineTo(95, 270);
    ctx.moveTo(145, 180);
    ctx.lineTo(165, 270);
    ctx.stroke();

    ctx.fillText("Front", 112, 310);

    // Back body
    ctx.beginPath();
    ctx.arc(390, 55, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeRect(365, 85, 50, 95);

    ctx.beginPath();
    ctx.moveTo(365, 100);
    ctx.lineTo(330, 165);
    ctx.moveTo(415, 100);
    ctx.lineTo(450, 165);
    ctx.moveTo(375, 180);
    ctx.lineTo(355, 270);
    ctx.moveTo(405, 180);
    ctx.lineTo(425, 270);
    ctx.stroke();

    ctx.fillText("Back", 374, 310);
  }

  function restoreBodyChartCanvas() {
    const canvas = bodyChartRef.current;
    if (!canvas) return;

    if (intakeForm.body_chart_image) {
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = intakeForm.body_chart_image;
    } else {
      drawBodyTemplate();
    }
  }

  function startBodyDraw(e) {
    e.preventDefault();
    const canvas = bodyChartRef.current;
    if (!canvas) return;

    isDrawingBodyRef.current = true;
    const ctx = canvas.getContext("2d");
    const point = getCanvasPoint(canvas, e);

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function drawBody(e) {
    e.preventDefault();
    if (!isDrawingBodyRef.current) return;

    const canvas = bodyChartRef.current;
    const ctx = canvas.getContext("2d");
    const point = getCanvasPoint(canvas, e);

    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#b42318";
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function stopBodyDraw() {
    isDrawingBodyRef.current = false;

    const canvas = bodyChartRef.current;
    if (!canvas) return;

    setIntakeForm((prev) => ({
      ...prev,
      body_chart_image: canvas.toDataURL("image/png"),
    }));
  }

  function clearBodyChart() {
    drawBodyTemplate();

    setIntakeForm((prev) => ({
      ...prev,
      body_chart_image: "",
    }));
  }

  function openPdfWindow(html) {
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  }

  function downloadSoapPdf() {
    if (!selectedClient) return alert("Please select a client first.");

    const clientName = `${selectedClient.first_name || ""} ${
      selectedClient.last_name || ""
    }`;

    const fileName = getClientFileName("SOAP_Note");

    openPdfWindow(`
      <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #09223f; line-height: 1.6; }
            h1 { color: #0f3d5e; margin-bottom: 4px; }
            h2 { border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-top: 26px; }
            .box { border: 1px solid #d6e2ee; border-radius: 10px; padding: 12px; min-height: 55px; white-space: pre-wrap; }
            .label { font-weight: bold; color: #0f3d5e; margin-top: 14px; }
          </style>
        </head>
        <body>
          <h1>YOHOME Massage & Myotherapy</h1>
          <p>SOAP Treatment Note</p>

          <h2>Client Information</h2>
          <p><b>Client:</b> ${clientName}</p>
          <p><b>Phone:</b> ${safeText(selectedClient.phone)}</p>
          <p><b>Email:</b> ${safeText(selectedClient.email)}</p>

          <h2>Treatment Details</h2>
          <p><b>Treatment Date:</b> ${safeText(soapForm.treatment_date)}</p>
          <p><b>Therapist:</b> ${safeText(soapForm.therapist_name)}</p>

          <h2>SOAP Note</h2>
          <div class="label">S - Subjective</div><div class="box">${safeText(soapForm.subjective)}</div>
          <div class="label">O - Objective</div><div class="box">${safeText(soapForm.objective)}</div>
          <div class="label">A - Assessment</div><div class="box">${safeText(soapForm.assessment)}</div>
          <div class="label">P - Plan</div><div class="box">${safeText(soapForm.plan)}</div>
          <div class="label">Therapist Notes</div><div class="box">${safeText(soapForm.therapist_notes)}</div>

          <script>window.print();</script>
        </body>
      </html>
    `);
  }

  function downloadFullReportPdf() {
    if (!selectedClient) return alert("Please select a client first.");

    const latestSignature =
  intakeForm.signature_image &&
  intakeForm.signature_image.length > 100
    ? intakeForm.signature_image
    : (
        signatureRef.current &&
        signatureRef.current.toDataURL("image/png")
      );

    const latestBodyChart =
  intakeForm.body_chart_image &&
  intakeForm.body_chart_image.length > 100
    ? intakeForm.body_chart_image
    : (
        bodyChartRef.current &&
        bodyChartRef.current.toDataURL("image/png")
      );

    const clientName = `${selectedClient.first_name || ""} ${
      selectedClient.last_name || ""
    }`;

    const soapHistoryHtml =
      soapNotes.length === 0
        ? `<p>No SOAP notes recorded.</p>`
        : soapNotes
            .map(
              (note, index) => `
                <div class="soapBlock">
                  <h3>SOAP Note ${soapNotes.length - index}</h3>
                  <p><b>Treatment Date:</b> ${safeText(note.treatment_date)}</p>
                  <p><b>Therapist:</b> ${safeText(note.therapist_name)}</p>

                  <div class="label">S - Subjective</div>
                  <div class="box">${safeText(note.subjective)}</div>

                  <div class="label">O - Objective</div>
                  <div class="box">${safeText(note.objective)}</div>

                  <div class="label">A - Assessment</div>
                  <div class="box">${safeText(note.assessment)}</div>

                  <div class="label">P - Plan</div>
                  <div class="box">${safeText(note.plan)}</div>

                  <div class="label">Therapist Notes</div>
                  <div class="box">${safeText(note.therapist_notes)}</div>
                </div>
              `
            )
            .join("");

    const fileName = getClientFileName("Full_Client_Report");

    openPdfWindow(`
      <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 38px; color: #09223f; line-height: 1.55; }
            h1 { color: #0f3d5e; margin-bottom: 4px; font-size: 28px; }
            .subtitle { color: #555; margin-bottom: 24px; }
            h2 { color: #0f3d5e; border-bottom: 2px solid #0f3d5e; padding-bottom: 6px; margin-top: 30px; }
            h3 { color: #09223f; margin-top: 22px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 28px; }
            .label { font-weight: bold; color: #0f3d5e; margin-top: 12px; margin-bottom: 4px; }
            .box { border: 1px solid #d6e2ee; border-radius: 10px; padding: 11px; min-height: 42px; white-space: pre-wrap; background: #fbfdff; }
            .imageBox { border: 1px solid #d6e2ee; border-radius: 10px; padding: 12px; background: #fbfdff; margin-top: 8px; }
            .imageBox img { max-width: 100%; display: block; }
            .signatureImage { max-width: 380px; }
            .soapBlock { page-break-inside: avoid; border: 1px solid #d6e2ee; border-radius: 14px; padding: 18px; margin-bottom: 20px; }
            .footer { margin-top: 36px; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 12px; }
            @media print { body { padding: 24px; } .soapBlock { page-break-inside: avoid; } }
          </style>
        </head>

        <body>
          <h1>YOHOME Massage & Myotherapy</h1>
          <div class="subtitle">Full Client Report — Client Information, Intake Form and SOAP History</div>

          <h2>Client Information</h2>
          <div class="grid">
            <p><b>Name:</b> ${clientName}</p>
            <p><b>Phone:</b> ${safeText(selectedClient.phone)}</p>
            <p><b>Email:</b> ${safeText(selectedClient.email)}</p>
            <p><b>Date of Birth:</b> ${safeText(selectedClient.date_of_birth)}</p>
            <p><b>Area / Suburb:</b> ${safeText(selectedClient.suburb_area)}</p>
            <p><b>Emergency Contact:</b> ${safeText(selectedClient.emergency_contact)}</p>
          </div>

          <div class="label">Client Notes</div>
          <div class="box">${safeText(selectedClient.notes)}</div>

          <h2>Intake Form</h2>
          <div class="label">Main Concern</div><div class="box">${safeText(intakeForm.main_concern)}</div>
          <div class="label">Pain Area</div><div class="box">${safeText(intakeForm.pain_area)}</div>
          <div class="label">Pain Level /10</div><div class="box">${safeText(intakeForm.pain_level)}</div>
          <div class="label">Medical History</div><div class="box">${safeText(intakeForm.medical_history)}</div>
          <div class="label">Medications</div><div class="box">${safeText(intakeForm.medications)}</div>
          <div class="label">Allergies</div><div class="box">${safeText(intakeForm.allergies)}</div>
          <div class="label">Contraindications / Cautions</div><div class="box">${safeText(intakeForm.contraindications)}</div>
          <div class="label">Body Chart Notes</div><div class="box">${safeText(intakeForm.body_chart_notes)}</div>
          ${
            latestBodyChart
              ? `<div class="label">Body Chart Image</div><div class="imageBox"><img src="${latestBodyChart}" /></div>`
              : ""
          }
          <div class="label">Risk Alerts</div><div class="box">${safeText(intakeForm.risk_alerts)}</div>
          <p><b>Consent Provided:</b> ${intakeForm.consent_given ? "Yes" : "No / Not recorded"}</p>
          <p><b>Signature Name:</b> ${safeText(intakeForm.signature_name)}</p>
          <p><b>Signature Date:</b> ${safeText(intakeForm.signature_date)}</p>
          ${
            latestSignature
              ? `<div class="label">Client Signature</div><div class="imageBox signatureImage"><img src="${latestSignature}" /></div>`
              : ""
          }

          <h2>SOAP Notes History</h2>
          ${soapHistoryHtml}

          <div class="footer">
            Generated from YOHOME Client Record System. This report is for clinical record purposes only.
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
  }

  function newClient() {
    setSelectedClient(null);
    setClientForm(emptyClient);
    setIntakeForm(emptyIntake);
    setIntakeHistory([]);
    setSoapForm(emptySoap);
    setSoapNotes([]);
    setActiveTab("client");
  }

  const filteredClients = clients.filter((client) => {
    const text = `${client.first_name || ""} ${client.last_name || ""} ${
      client.phone || ""
    } ${client.email || ""}`.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h2>YOHOME</h2>
          <p>Client Records</p>
        </div>

        <input
          className="search"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button className="newBtn" onClick={newClient}>
          + New Client
        </button>

        <div className="clientList">
          {filteredClients.map((client) => (
            <button
              key={client.id}
              className={
                selectedClient?.id === client.id
                  ? "clientItem active"
                  : "clientItem"
              }
              onClick={() => selectClient(client)}
            >
              <strong>
                {client.first_name} {client.last_name}
              </strong>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1>
            {selectedClient
              ? `${selectedClient.first_name || ""} ${
                  selectedClient.last_name || ""
                }`
              : "New Client"}
          </h1>
          <p>Client registration, intake form and SOAP notes</p>
        </header>

        <div className="tabs">
          <button
            className={activeTab === "client" ? "tab active" : "tab"}
            onClick={() => setActiveTab("client")}
          >
            Client Info
          </button>

          <button
            className={activeTab === "intake" ? "tab active" : "tab"}
            onClick={() => setActiveTab("intake")}
          >
            Intake Form
          </button>

          <button
            className={activeTab === "soap" ? "tab active" : "tab"}
            onClick={() => setActiveTab("soap")}
          >
            SOAP Notes
          </button>
        </div>

        {activeTab === "client" && (
          <section className="card">
            <div className="cardTitle">
              <h2>Client Information</h2>
              <p>Basic client contact and clinical note details.</p>
            </div>

            <div className="grid">
              <label>
                First Name
                <input
                  name="first_name"
                  value={clientForm.first_name || ""}
                  onChange={handleClientChange}
                />
              </label>

              <label>
                Last Name
                <input
                  name="last_name"
                  value={clientForm.last_name || ""}
                  onChange={handleClientChange}
                />
              </label>

              <label>
                Phone
                <input
                  name="phone"
                  value={clientForm.phone || ""}
                  onChange={handleClientChange}
                />
              </label>

              <label>
                Email
                <input
                  name="email"
                  value={clientForm.email || ""}
                  onChange={handleClientChange}
                />
              </label>

              <label>
                Date of Birth
                <input
                  type="date"
                  name="date_of_birth"
                  value={clientForm.date_of_birth || ""}
                  onChange={handleClientChange}
                />
              </label>

              <label>
                Area / Suburb
                <input
                  name="suburb_area"
                  value={clientForm.suburb_area || ""}
                  onChange={handleClientChange}
                  placeholder="Example: Abbotsford, Richmond, Glen Iris"
                />
              </label>
            </div>

            <label>
              Emergency Contact
              <textarea
                name="emergency_contact"
                value={clientForm.emergency_contact || ""}
                onChange={handleClientChange}
              />
            </label>

            <label>
              Notes
              <textarea
                name="notes"
                value={clientForm.notes || ""}
                onChange={handleClientChange}
              />
            </label>

            <div className="actions">
              {!selectedClient ? (
                <button onClick={saveNewClient} disabled={loading}>
                  Save New Client
                </button>
              ) : (
                <>
                  <button onClick={updateClient} disabled={loading}>
                    Update Client
                  </button>

                  <button className="danger" onClick={deleteClient}>
                    Delete Client
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={downloadFullReportPdf}
                  >
                    Download Full Report PDF
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {activeTab === "intake" && (
          <section className="card">
            <div className="cardTitle">
              <h2>Intake Form</h2>
              <p>Client health history, consent, body chart and risk alerts.</p>
            </div>

            {!selectedClient && (
              <p className="warning">Please save or select a client first.</p>
            )}

            <label>
              Main Concern
              <textarea
                name="main_concern"
                value={intakeForm.main_concern || ""}
                onChange={handleIntakeChange}
              />
            </label>

            <label>
              Pain Area
              <textarea
                name="pain_area"
                value={intakeForm.pain_area || ""}
                onChange={handleIntakeChange}
              />
            </label>

            <div className="grid">
              <label>
                Pain Level /10
                <input
                  name="pain_level"
                  value={intakeForm.pain_level || ""}
                  onChange={handleIntakeChange}
                />
              </label>
            </div>

            <label>
              Medical History
              <textarea
                name="medical_history"
                value={intakeForm.medical_history || ""}
                onChange={handleIntakeChange}
              />
            </label>

            <label>
              Medications
              <textarea
                name="medications"
                value={intakeForm.medications || ""}
                onChange={handleIntakeChange}
              />
            </label>

            <label>
              Allergies
              <textarea
                name="allergies"
                value={intakeForm.allergies || ""}
                onChange={handleIntakeChange}
              />
            </label>

            <label>
              Contraindications / Cautions
              <textarea
                name="contraindications"
                value={intakeForm.contraindications || ""}
                onChange={handleIntakeChange}
              />
            </label>

            <label>
              Body Chart Notes
              <textarea
                name="body_chart_notes"
                value={intakeForm.body_chart_notes || ""}
                onChange={handleIntakeChange}
                placeholder="Example: right shoulder, lower back, left hip..."
              />
            </label>

            <div className="canvasBox">
              <h3>Body Chart</h3>
              <p>Circle or mark painful / restricted areas.</p>

              <canvas
                ref={bodyChartRef}
                width="520"
                height="330"
                className="bodyCanvas"
                onMouseDown={startBodyDraw}
                onMouseMove={drawBody}
                onMouseUp={stopBodyDraw}
                onMouseLeave={stopBodyDraw}
                onTouchStart={startBodyDraw}
                onTouchMove={drawBody}
                onTouchEnd={stopBodyDraw}
              />

              <button type="button" className="clearBtn" onClick={clearBodyChart}>
                Clear Body Chart
              </button>
            </div>

            <label>
              Risk Alerts
              <textarea
                name="risk_alerts"
                value={intakeForm.risk_alerts || ""}
                onChange={handleIntakeChange}
                placeholder="Example: pregnancy, blood thinners, recent surgery..."
              />
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                name="consent_given"
                checked={!!intakeForm.consent_given}
                onChange={handleIntakeChange}
              />
              Client has provided consent for assessment and treatment.
            </label>

            <div className="grid">
              <label>
                Signature Name
                <input
                  name="signature_name"
                  value={intakeForm.signature_name || ""}
                  onChange={handleIntakeChange}
                  placeholder="Client full name"
                />
              </label>

              <label>
                Signature Date
                <input
                  type="date"
                  name="signature_date"
                  value={intakeForm.signature_date || ""}
                  onChange={handleIntakeChange}
                />
              </label>
            </div>

            <div className="canvasBox">
              <h3>Client Signature</h3>
              <p>Client can sign directly using mouse, finger or iPad.</p>

              <canvas
                ref={signatureRef}
                width="700"
                height="180"
                className="signatureCanvas"
                onMouseDown={startSignature}
                onMouseMove={drawSignature}
                onMouseUp={stopSignature}
                onMouseLeave={stopSignature}
                onTouchStart={startSignature}
                onTouchMove={drawSignature}
                onTouchEnd={stopSignature}
              />

              <button type="button" className="clearBtn" onClick={clearSignature}>
                Clear Signature
              </button>
            </div>

            <div className="historyTitle">
              <h3>Previous Intake Records</h3>
            </div>

            <div className="soapHistory">
              {intakeHistory.length === 0 && (
                <p className="warning">No previous intake records found.</p>
              )}

              {intakeHistory.map((record, index) => (
                <div className="soapItem" key={record.id || index}>
                  <div className="soapTop">
                    <div>
                      <strong>
                        {record.created_at
                          ? new Date(record.created_at).toLocaleDateString()
                          : "No date"}
                      </strong>
                      <span>
                        {index === 0 ? "Latest intake record" : "Previous intake record"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => loadIntakeFromHistory(record)}
                    >
                      Load
                    </button>
                  </div>

                  <p>
                    <b>Main Concern:</b> {record.main_concern || "Not recorded"}
                  </p>
                  <p>
                    <b>Pain Area:</b> {record.pain_area || "Not recorded"}
                  </p>
                  <p>
                    <b>Pain Level:</b> {record.pain_level || "Not recorded"}
                  </p>
                  <p>
                    <b>Risk Alerts:</b> {record.risk_alerts || "Not recorded"}
                  </p>
                </div>
              ))}
            </div>

            <div className="actions">
              <button onClick={saveIntake}>Save Intake</button>

              {selectedClient && (
                <button
                  type="button"
                  className="secondary"
                  onClick={downloadFullReportPdf}
                >
                  Download Full Report PDF
                </button>
              )}
            </div>
          </section>
        )}

        {activeTab === "soap" && (
          <section className="card">
            <div className="cardTitle">
              <h2>SOAP Notes</h2>
              <p>Record treatment notes and download printable PDFs.</p>
            </div>

            {!selectedClient && (
              <p className="warning">Please save or select a client first.</p>
            )}

            <div className="grid">
              <label>
                Treatment Date
                <input
                  type="date"
                  name="treatment_date"
                  value={soapForm.treatment_date || ""}
                  onChange={handleSoapChange}
                />
              </label>

              <label>
                Therapist Name
                <select
                  name="therapist_name"
                  value={soapForm.therapist_name || ""}
                  onChange={handleSoapChange}
                >
                  <option value="">Select therapist</option>
                  {therapists.map((therapist) => (
                    <option key={therapist.id} value={therapist.name}>
                      {therapist.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="therapistBox">
              <div className="therapistHeader">
                <h3>Manage Therapists</h3>
                <p>Add or remove therapist names for SOAP records.</p>
              </div>

              <div className="therapistAdd">
                <input
                  placeholder="Enter therapist name"
                  value={newTherapist}
                  onChange={(e) => setNewTherapist(e.target.value)}
                />

                <button type="button" onClick={addTherapist}>
                  Add Therapist
                </button>
              </div>

              <div className="therapistList">
                {therapists.map((therapist) => (
                  <div className="therapistTag" key={therapist.id}>
                    <span>{therapist.name}</span>
                    <button
                      type="button"
                      onClick={() => deleteTherapist(therapist.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label>
              S - Subjective
              <textarea
                name="subjective"
                value={soapForm.subjective || ""}
                onChange={handleSoapChange}
                placeholder="Client's reported symptoms, concerns, pain level..."
              />
            </label>

            <label>
              O - Objective
              <textarea
                name="objective"
                value={soapForm.objective || ""}
                onChange={handleSoapChange}
                placeholder="Observation, movement, palpation findings..."
              />
            </label>

            <label>
              A - Assessment
              <textarea
                name="assessment"
                value={soapForm.assessment || ""}
                onChange={handleSoapChange}
                placeholder="Clinical impression within scope..."
              />
            </label>

            <label>
              P - Plan
              <textarea
                name="plan"
                value={soapForm.plan || ""}
                onChange={handleSoapChange}
                placeholder="Treatment provided, home care, next visit plan..."
              />
            </label>

            <label>
              Therapist Notes
              <textarea
                name="therapist_notes"
                value={soapForm.therapist_notes || ""}
                onChange={handleSoapChange}
              />
            </label>

            <div className="actions">
              <button onClick={saveSoapNote}>Save SOAP Note</button>

              <button
                type="button"
                className="secondary"
                onClick={downloadSoapPdf}
              >
                Download SOAP PDF
              </button>

              <button
                type="button"
                className="secondary"
                onClick={downloadFullReportPdf}
              >
                Download Full Report PDF
              </button>
            </div>

            <div className="historyTitle">
              <h3>Previous SOAP Notes</h3>
            </div>

            <div className="soapHistory">
              {soapNotes.map((note) => (
                <div className="soapItem" key={note.id}>
                  <div className="soapTop">
                    <div>
                      <strong>{note.treatment_date || "No date"}</strong>
                      <span>
                        {note.therapist_name || "Therapist not recorded"}
                      </span>
                    </div>

                    <button
                      className="smallDanger"
                      onClick={() => deleteSoapNote(note.id)}
                    >
                      Delete
                    </button>
                  </div>

                  <p>
                    <b>S:</b> {note.subjective}
                  </p>
                  <p>
                    <b>O:</b> {note.objective}
                  </p>
                  <p>
                    <b>A:</b> {note.assessment}
                  </p>
                  <p>
                    <b>P:</b> {note.plan}
                  </p>

                  {note.therapist_notes && (
                    <p>
                      <b>Therapist Notes:</b> {note.therapist_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
