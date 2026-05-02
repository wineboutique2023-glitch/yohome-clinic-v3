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

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

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

    if (error) {
      alert(error.message);
      return;
    }

    setIntakeForm(data || emptyIntake);
  }

  async function fetchSoapNotes(clientId) {
    const { data, error } = await supabase
      .from("soap_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setSoapNotes(data || []);
  }

  function handleClientChange(e) {
    const { name, value } = e.target;
    setClientForm({ ...clientForm, [name]: value });
  }

  function handleIntakeChange(e) {
    const { name, value, type, checked } = e.target;
    setIntakeForm({
      ...intakeForm,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  function handleSoapChange(e) {
    const { name, value } = e.target;
    setSoapForm({ ...soapForm, [name]: value });
  }

  async function saveNewClient() {
    if (!clientForm.first_name && !clientForm.last_name) {
      alert("Please enter client name.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("clients")
      .insert([clientForm])
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchClients();
    await selectClient(data);
    alert("Client saved.");
  }

  async function updateClient() {
    if (!selectedClient) {
      alert("Please select a client first.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("clients")
      .update(clientForm)
      .eq("id", selectedClient.id);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchClients();
    alert("Client updated.");
  }

  async function deleteClient() {
    if (!selectedClient) {
      alert("Please select a client first.");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this client? This will also delete their intake and SOAP notes."
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", selectedClient.id);

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedClient(null);
    setClientForm(emptyClient);
    setIntakeForm(emptyIntake);
    setSoapForm(emptySoap);
    setSoapNotes([]);
    await fetchClients();

    alert("Client deleted.");
  }

  async function saveIntake() {
    if (!selectedClient) {
      alert("Please select a client first.");
      return;
    }

    const intakeData = {
      ...intakeForm,
      client_id: selectedClient.id,
    };

    let result;

    if (intakeForm.id) {
      result = await supabase
        .from("intake_forms")
        .update(intakeData)
        .eq("id", intakeForm.id);
    } else {
      result = await supabase
        .from("intake_forms")
        .insert([intakeData])
        .select()
        .single();
    }

    if (result.error) {
      alert(result.error.message);
      return;
    }

    await fetchIntake(selectedClient.id);
    alert("Intake form saved.");
  }

  async function saveSoapNote() {
    if (!selectedClient) {
      alert("Please select a client first.");
      return;
    }

    const soapData = {
      ...soapForm,
      client_id: selectedClient.id,
    };

    const { error } = await supabase.from("soap_notes").insert([soapData]);

    if (error) {
      alert(error.message);
      return;
    }

    setSoapForm(emptySoap);
    await fetchSoapNotes(selectedClient.id);
    alert("SOAP note saved.");
  }

  async function deleteSoapNote(id) {
    const confirmDelete = window.confirm("Delete this SOAP note?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("soap_notes").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchSoapNotes(selectedClient.id);
  }

  function downloadSoapPdf() {
    if (!selectedClient) {
      alert("Please select a client first.");
      return;
    }

    const clientName = `${selectedClient.first_name || ""} ${
      selectedClient.last_name || ""
    }`;

    const win = window.open("", "_blank");

    win.document.write(`
      <html>
        <head>
          <title>YOHOME SOAP Note</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #09223f;
              line-height: 1.6;
            }
            h1 {
              color: #0f3d5e;
              margin-bottom: 5px;
            }
            h2 {
              border-bottom: 1px solid #ccc;
              padding-bottom: 6px;
              margin-top: 28px;
            }
            .info {
              margin-bottom: 20px;
              font-size: 14px;
            }
            .section {
              margin-bottom: 18px;
            }
            .label {
              font-weight: bold;
              color: #0f3d5e;
            }
            .box {
              border: 1px solid #d6e2ee;
              border-radius: 10px;
              padding: 12px;
              min-height: 60px;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <h1>YOHOME Massage & Myotherapy</h1>
          <div class="info">SOAP Treatment Note</div>

          <h2>Client Information</h2>
          <p><b>Client:</b> ${clientName}</p>
          <p><b>Phone:</b> ${selectedClient.phone || ""}</p>
          <p><b>Email:</b> ${selectedClient.email || ""}</p>

          <h2>Treatment Details</h2>
          <p><b>Treatment Date:</b> ${soapForm.treatment_date || ""}</p>
          <p><b>Therapist:</b> ${soapForm.therapist_name || ""}</p>

          <h2>SOAP Note</h2>

          <div class="section">
            <div class="label">S - Subjective</div>
            <div class="box">${soapForm.subjective || ""}</div>
          </div>

          <div class="section">
            <div class="label">O - Objective</div>
            <div class="box">${soapForm.objective || ""}</div>
          </div>

          <div class="section">
            <div class="label">A - Assessment</div>
            <div class="box">${soapForm.assessment || ""}</div>
          </div>

          <div class="section">
            <div class="label">P - Plan</div>
            <div class="box">${soapForm.plan || ""}</div>
          </div>

          <div class="section">
            <div class="label">Therapist Notes</div>
            <div class="box">${soapForm.therapist_notes || ""}</div>
          </div>

          <script>
            window.print();
          </script>
        </body>
      </html>
    `);

    win.document.close();
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
        <h2>YOHOME</h2>
        <p>Client Records</p>

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
              <span>{client.phone}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="header">
          <h1>
            {selectedClient
              ? `${selectedClient.first_name || ""} ${
                  selectedClient.last_name || ""
                }`
              : "New Client"}
          </h1>
          <p>Client registration, intake form and SOAP notes</p>
        </div>

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
            <h2>Client Information</h2>

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
                Address
                <input
                  name="address"
                  value={clientForm.address || ""}
                  onChange={handleClientChange}
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
              {!selectedClient && (
                <button onClick={saveNewClient} disabled={loading}>
                  Save New Client
                </button>
              )}

              {selectedClient && (
                <>
                  <button onClick={updateClient} disabled={loading}>
                    Update Client
                  </button>

                  <button className="danger" onClick={deleteClient}>
                    Delete Client
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {activeTab === "intake" && (
          <section className="card">
            <h2>Intake Form</h2>

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

            <label>
              Pain Level /10
              <input
                name="pain_level"
                value={intakeForm.pain_level || ""}
                onChange={handleIntakeChange}
              />
            </label>

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

            <label className="checkbox">
              <input
                type="checkbox"
                name="consent_given"
                checked={!!intakeForm.consent_given}
                onChange={handleIntakeChange}
              />
              Client has provided consent for assessment and treatment.
            </label>

            <div className="actions">
              <button onClick={saveIntake}>Save Intake</button>
            </div>
          </section>
        )}

        {activeTab === "soap" && (
          <section className="card">
            <h2>SOAP Notes</h2>

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
                  <option value="Zheng Yi">Zheng Yi</option>
                  <option value="Tree">Tree</option>
                  <option value="Nancy">Nancy</option>
                  <option value="Cedrick">Cedrick</option>
                </select>
              </label>
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
              <button type="button" onClick={downloadSoapPdf}>
                Download PDF
              </button>
            </div>

            <h3>Previous SOAP Notes</h3>

            <div className="soapHistory">
              {soapNotes.map((note) => (
                <div className="soapItem" key={note.id}>
                  <div className="soapTop">
                    <strong>{note.treatment_date || "No date"}</strong>
                    <button
                      className="smallDanger"
                      onClick={() => deleteSoapNote(note.id)}
                    >
                      Delete
                    </button>
                  </div>

                  <p>
                    <b>Therapist:</b>{" "}
                    {note.therapist_name || "Not recorded"}
                  </p>

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
