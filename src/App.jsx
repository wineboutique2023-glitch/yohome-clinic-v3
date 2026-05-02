import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./styles.css";

const emptyClient = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  date_of_birth: "",
  address: "",
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
  const [soapForm, setSoapForm] = useState(emptySoap);
  const [soapNotes, setSoapNotes] = useState([]);
  const [activeTab, setActiveTab] = useState("client");
  const [loading, setLoading] = useState(false);
  const [therapists, setTherapists] = useState([]);
  const [newTherapist, setNewTherapist] = useState("");

  useEffect(() => {
    fetchClients();
    const saved = localStorage.getItem("yohome_therapists");
    setTherapists(saved ? JSON.parse(saved) : ["Zheng Yi", "Tree", "Nancy", "Cedrick"]);
  }, []);

  useEffect(() => {
    localStorage.setItem("yohome_therapists", JSON.stringify(therapists));
  }, [therapists]);

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
    await fetchSoapNotes(client.id);
  }

  async function fetchIntake(clientId) {
    const { data, error } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) return alert(error.message);
    setIntakeForm(data || emptyIntake);
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
    setIntakeForm({ ...intakeForm, [name]: type === "checkbox" ? checked : value });
  }

  function handleSoapChange(e) {
    setSoapForm({ ...soapForm, [e.target.name]: e.target.value });
  }

  function addTherapist() {
    const name = newTherapist.trim();
    if (!name) return;
    if (therapists.includes(name)) return alert("Therapist already exists.");
    setTherapists([...therapists, name]);
    setNewTherapist("");
  }

  function deleteTherapist(name) {
    if (!window.confirm(`Delete therapist "${name}"?`)) return;
    setTherapists(therapists.filter((t) => t !== name));
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

    const intakeData = { ...intakeForm, client_id: selectedClient.id };
    let result;

    if (intakeForm.id) {
      result = await supabase
        .from("intake_forms")
        .update(intakeData)
        .eq("id", intakeForm.id);
    } else {
      result = await supabase.from("intake_forms").insert([intakeData]).select().single();
    }

    if (result.error) return alert(result.error.message);

    await fetchIntake(selectedClient.id);
    alert("Intake form saved.");
  }

  async function saveSoapNote() {
    if (!selectedClient) return alert("Please select a client first.");

    const soapData = { ...soapForm, client_id: selectedClient.id };
    const { error } = await supabase.from("soap_notes").insert([soapData]);

    if (error) return alert(error.message);

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

  function openPdfWindow(html) {
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  }

  function downloadSoapPdf() {
    if (!selectedClient) return alert("Please select a client first.");

    const clientName = `${selectedClient.first_name || ""} ${selectedClient.last_name || ""}`;

    openPdfWindow(`
      <html>
        <head>
          <title>YOHOME SOAP Note</title>
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

    const clientName = `${selectedClient.first_name || ""} ${selectedClient.last_name || ""}`;

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

    openPdfWindow(`
      <html>
        <head>
          <title>YOHOME Full Client Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 38px;
              color: #09223f;
              line-height: 1.55;
            }

            h1 {
              color: #0f3d5e;
              margin-bottom: 4px;
              font-size: 28px;
            }

            .subtitle {
              color: #555;
              margin-bottom: 24px;
            }

            h2 {
              color: #0f3d5e;
              border-bottom: 2px solid #0f3d5e;
              padding-bottom: 6px;
              margin-top: 30px;
            }

            h3 {
              color: #09223f;
              margin-top: 22px;
            }

            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 28px;
            }

            .section {
              margin-bottom: 18px;
            }

            .label {
              font-weight: bold;
              color: #0f3d5e;
              margin-top: 12px;
              margin-bottom: 4px;
            }

            .box {
              border: 1px solid #d6e2ee;
              border-radius: 10px;
              padding: 11px;
              min-height: 42px;
              white-space: pre-wrap;
              background: #fbfdff;
            }

            .soapBlock {
              page-break-inside: avoid;
              border: 1px solid #d6e2ee;
              border-radius: 14px;
              padding: 18px;
              margin-bottom: 20px;
            }

            .footer {
              margin-top: 36px;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #ddd;
              padding-top: 12px;
            }

            @media print {
              body { padding: 24px; }
              .soapBlock { page-break-inside: avoid; }
            }
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
            <p><b>Address:</b> ${safeText(selectedClient.address)}</p>
            <p><b>Emergency Contact:</b> ${safeText(selectedClient.emergency_contact)}</p>
          </div>

          <div class="label">Client Notes</div>
          <div class="box">${safeText(selectedClient.notes)}</div>

          <h2>Intake Form</h2>

          <div class="label">Main Concern</div>
          <div class="box">${safeText(intakeForm.main_concern)}</div>

          <div class="label">Pain Area</div>
          <div class="box">${safeText(intakeForm.pain_area)}</div>

          <div class="label">Pain Level /10</div>
          <div class="box">${safeText(intakeForm.pain_level)}</div>

          <div class="label">Medical History</div>
          <div class="box">${safeText(intakeForm.medical_history)}</div>

          <div class="label">Medications</div>
          <div class="box">${safeText(intakeForm.medications)}</div>

          <div class="label">Allergies</div>
          <div class="box">${safeText(intakeForm.allergies)}</div>

          <div class="label">Contraindications / Cautions</div>
          <div class="box">${safeText(intakeForm.contraindications)}</div>

          <p><b>Consent Provided:</b> ${intakeForm.consent_given ? "Yes" : "No / Not recorded"}</p>

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
              className={selectedClient?.id === client.id ? "clientItem active" : "clientItem"}
              onClick={() => selectClient(client)}
            >
              <strong>
                {client.first_name} {client.last_name}
              </strong>
              <span>{client.phone || "No phone"}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1>
            {selectedClient
              ? `${selectedClient.first_name || ""} ${selectedClient.last_name || ""}`
              : "New Client"}
          </h1>
          <p>Client registration, intake form and SOAP notes</p>
        </header>

        <div className="tabs">
          <button className={activeTab === "client" ? "tab active" : "tab"} onClick={() => setActiveTab("client")}>
            Client Info
          </button>
          <button className={activeTab === "intake" ? "tab active" : "tab"} onClick={() => setActiveTab("intake")}>
            Intake Form
          </button>
          <button className={activeTab === "soap" ? "tab active" : "tab"} onClick={() => setActiveTab("soap")}>
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
              <label>First Name<input name="first_name" value={clientForm.first_name || ""} onChange={handleClientChange} /></label>
              <label>Last Name<input name="last_name" value={clientForm.last_name || ""} onChange={handleClientChange} /></label>
              <label>Phone<input name="phone" value={clientForm.phone || ""} onChange={handleClientChange} /></label>
              <label>Email<input name="email" value={clientForm.email || ""} onChange={handleClientChange} /></label>
              <label>Date of Birth<input type="date" name="date_of_birth" value={clientForm.date_of_birth || ""} onChange={handleClientChange} /></label>
              <label>Address<input name="address" value={clientForm.address || ""} onChange={handleClientChange} /></label>
            </div>

            <label>Emergency Contact<textarea name="emergency_contact" value={clientForm.emergency_contact || ""} onChange={handleClientChange} /></label>
            <label>Notes<textarea name="notes" value={clientForm.notes || ""} onChange={handleClientChange} /></label>

            <div className="actions">
              {!selectedClient ? (
                <button onClick={saveNewClient} disabled={loading}>Save New Client</button>
              ) : (
                <>
                  <button onClick={updateClient} disabled={loading}>Update Client</button>
                  <button className="danger" onClick={deleteClient}>Delete Client</button>
                  <button type="button" className="secondary" onClick={downloadFullReportPdf}>Download Full Report PDF</button>
                </>
              )}
            </div>
          </section>
        )}

        {activeTab === "intake" && (
          <section className="card">
            <div className="cardTitle">
              <h2>Intake Form</h2>
              <p>Client health history, concerns and consent.</p>
            </div>

            {!selectedClient && <p className="warning">Please save or select a client first.</p>}

            <label>Main Concern<textarea name="main_concern" value={intakeForm.main_concern || ""} onChange={handleIntakeChange} /></label>
            <label>Pain Area<textarea name="pain_area" value={intakeForm.pain_area || ""} onChange={handleIntakeChange} /></label>

            <div className="grid">
              <label>Pain Level /10<input name="pain_level" value={intakeForm.pain_level || ""} onChange={handleIntakeChange} /></label>
            </div>

            <label>Medical History<textarea name="medical_history" value={intakeForm.medical_history || ""} onChange={handleIntakeChange} /></label>
            <label>Medications<textarea name="medications" value={intakeForm.medications || ""} onChange={handleIntakeChange} /></label>
            <label>Allergies<textarea name="allergies" value={intakeForm.allergies || ""} onChange={handleIntakeChange} /></label>
            <label>Contraindications / Cautions<textarea name="contraindications" value={intakeForm.contraindications || ""} onChange={handleIntakeChange} /></label>

            <label className="checkbox">
              <input type="checkbox" name="consent_given" checked={!!intakeForm.consent_given} onChange={handleIntakeChange} />
              Client has provided consent for assessment and treatment.
            </label>

            <div className="actions">
              <button onClick={saveIntake}>Save Intake</button>
              {selectedClient && (
                <button type="button" className="secondary" onClick={downloadFullReportPdf}>
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

            {!selectedClient && <p className="warning">Please save or select a client first.</p>}

            <div className="grid">
              <label>Treatment Date<input type="date" name="treatment_date" value={soapForm.treatment_date || ""} onChange={handleSoapChange} /></label>

              <label>
                Therapist Name
                <select name="therapist_name" value={soapForm.therapist_name || ""} onChange={handleSoapChange}>
                  <option value="">Select therapist</option>
                  {therapists.map((therapist) => (
                    <option key={therapist} value={therapist}>{therapist}</option>
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
                <input placeholder="Enter therapist name" value={newTherapist} onChange={(e) => setNewTherapist(e.target.value)} />
                <button type="button" onClick={addTherapist}>Add Therapist</button>
              </div>

              <div className="therapistList">
                {therapists.map((therapist) => (
                  <div className="therapistTag" key={therapist}>
                    <span>{therapist}</span>
                    <button type="button" onClick={() => deleteTherapist(therapist)}>×</button>
                  </div>
                ))}
              </div>
            </div>

            <label>S - Subjective<textarea name="subjective" value={soapForm.subjective || ""} onChange={handleSoapChange} placeholder="Client's reported symptoms, concerns, pain level..." /></label>
            <label>O - Objective<textarea name="objective" value={soapForm.objective || ""} onChange={handleSoapChange} placeholder="Observation, movement, palpation findings..." /></label>
            <label>A - Assessment<textarea name="assessment" value={soapForm.assessment || ""} onChange={handleSoapChange} placeholder="Clinical impression within scope..." /></label>
            <label>P - Plan<textarea name="plan" value={soapForm.plan || ""} onChange={handleSoapChange} placeholder="Treatment provided, home care, next visit plan..." /></label>
            <label>Therapist Notes<textarea name="therapist_notes" value={soapForm.therapist_notes || ""} onChange={handleSoapChange} /></label>

            <div className="actions">
              <button onClick={saveSoapNote}>Save SOAP Note</button>
              <button type="button" className="secondary" onClick={downloadSoapPdf}>Download SOAP PDF</button>
              <button type="button" className="secondary" onClick={downloadFullReportPdf}>Download Full Report PDF</button>
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
                      <span>{note.therapist_name || "Therapist not recorded"}</span>
                    </div>

                    <button className="smallDanger" onClick={() => deleteSoapNote(note.id)}>Delete</button>
                  </div>

                  <p><b>S:</b> {note.subjective}</p>
                  <p><b>O:</b> {note.objective}</p>
                  <p><b>A:</b> {note.assessment}</p>
                  <p><b>P:</b> {note.plan}</p>

                  {note.therapist_notes && <p><b>Therapist Notes:</b> {note.therapist_notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
