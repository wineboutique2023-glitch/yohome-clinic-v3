import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const today = () => new Date().toISOString().slice(0, 10);

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
  form_date: today(),
  therapist: "",
  main_reason: "",
  conditions_injuries: "",
  medications: "",
  allergies: "",
  areas_to_avoid: "",
  consent_notes:
    "Client confirms the information provided is accurate and consents to treatment within scope.",
};

const emptySoap = {
  session_date: today(),
  therapist: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  techniques_used: "",
  session_duration: "",
  next_review: "",
};

function fullName(client) {
  return [client?.first_name, client?.last_name].filter(Boolean).join(" ") || "New Client";
}

function cleanDate(value) {
  return value && String(value).trim() ? value : null;
}

function Field({ label, value, onChange, type = "text", textarea = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function PrintView({ data, onClose }) {
  if (!data) return null;

  const { type, client, record } = data;
  const isIntake = type === "Intake";

  return (
    <div className="printOverlay">
      <div className="printActions noPrint">
        <button onClick={onClose}>Close</button>
        <button onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <div className="printPage">
        <header className="printHeader">
          <div>
            <h1>YOHOME Massage & Myotherapy</h1>
            <p>{type} Record</p>
          </div>
          <div>
            <strong>{fullName(client)}</strong>
            <br />
            {isIntake ? record.form_date : record.session_date}
            <br />
            Therapist: {record.therapist || "-"}
          </div>
        </header>

        <section className="printInfo">
          <p><b>Phone:</b> {client.phone || "-"}</p>
          <p><b>Email:</b> {client.email || "-"}</p>
          <p><b>DOB:</b> {client.date_of_birth || "-"}</p>
          <p><b>Address:</b> {client.address || "-"}</p>
        </section>

        {isIntake ? (
          <>
            <Block title="Main Reason" text={record.main_reason} />
            <Block title="Conditions / Injuries" text={record.conditions_injuries} />
            <Block title="Medications" text={record.medications} />
            <Block title="Allergies" text={record.allergies} />
            <Block title="Areas to Avoid" text={record.areas_to_avoid} />
            <Block title="Consent Notes" text={record.consent_notes} />
          </>
        ) : (
          <>
            <Block title="Subjective" text={record.subjective} />
            <Block title="Objective" text={record.objective} />
            <Block title="Assessment" text={record.assessment} />
            <Block title="Plan" text={record.plan} />
            <Block title="Techniques Used" text={record.techniques_used} />
            <Block title="Session Duration" text={record.session_duration} />
            <Block title="Next Review" text={record.next_review} />
          </>
        )}
      </div>
    </div>
  );
}

function Block({ title, text }) {
  return (
    <section className="printBlock">
      <h3>{title}</h3>
      <p>{text || "-"}</p>
    </section>
  );
}

export default function App() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [intake, setIntake] = useState(emptyIntake);
  const [soap, setSoap] = useState(emptySoap);
  const [intakes, setIntakes] = useState([]);
  const [soaps, setSoaps] = useState([]);
  const [tab, setTab] = useState("profile");
  const [search, setSearch] = useState("");
  const [printData, setPrintData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selected) {
      setClientForm({
        ...selected,
        date_of_birth: selected.date_of_birth || "",
      });
      loadRecords(selected.id);
    }
  }, [selected]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.phone || ""} ${c.email || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [clients, search]);

  async function loadClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setClients(data || []);
    if (!selected && data?.length) setSelected(data[0]);
  }

  async function loadRecords(clientId) {
    const intakeRes = await supabase
      .from("intake_forms")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    const soapRes = await supabase
      .from("soap_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (intakeRes.error) alert(intakeRes.error.message);
    if (soapRes.error) alert(soapRes.error.message);

    setIntakes(intakeRes.data || []);
    setSoaps(soapRes.data || []);
  }

  function newClient() {
    setSelected(null);
    setClientForm(emptyClient);
    setIntakes([]);
    setSoaps([]);
    setTab("profile");
  }

  async function saveClient(e) {
    e.preventDefault();

    const payload = {
      ...clientForm,
      date_of_birth: cleanDate(clientForm.date_of_birth),
    };

    let result;

    if (selected?.id) {
      result = await supabase
        .from("clients")
        .update(payload)
        .eq("id", selected.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("clients")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setSelected(result.data);
    await loadClients();
    alert("Client saved.");
  }

  async function saveIntake(e) {
    e.preventDefault();

    if (!selected?.id) {
      alert("Please save or select a client first.");
      return;
    }

    const payload = {
      ...intake,
      form_date: cleanDate(intake.form_date),
      client_id: selected.id,
    };

    const { data, error } = await supabase
      .from("intake_forms")
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await loadRecords(selected.id);
    setPrintData({ type: "Intake", client: selected, record: data });
    setIntake(emptyIntake);
  }

  async function saveSoap(e) {
    e.preventDefault();

    if (!selected?.id) {
      alert("Please save or select a client first.");
      return;
    }

    const payload = {
      ...soap,
      session_date: cleanDate(soap.session_date),
      client_id: selected.id,
    };

    const { data, error } = await supabase
      .from("soap_notes")
      .insert(payload)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await loadRecords(selected.id);
    setPrintData({ type: "SOAP", client: selected, record: data });
    setSoap(emptySoap);
  }

  return (
    <>
      <PrintView data={printData} onClose={() => setPrintData(null)} />

      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <h1>YOHOME</h1>
            <p>Clinic Records</p>
          </div>

          <button className="primary full" onClick={newClient}>
            + New Client
          </button>

          <input
            className="search"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="clientList">
            {loading && <p>Loading...</p>}

            {filteredClients.map((client) => (
              <button
                key={client.id}
                className={selected?.id === client.id ? "client active" : "client"}
                onClick={() => setSelected(client)}
              >
                <strong>{fullName(client)}</strong>
                <span>{client.phone || client.email || "No contact"}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="main">
          <header className="topCard">
            <h2>{selected ? fullName(selected) : "New Client"}</h2>
            <p>Client profile, intake form and SOAP history.</p>
          </header>

          <nav className="tabs">
            <button className={tab === "profile" ? "on" : ""} onClick={() => setTab("profile")}>
              Client Profile
            </button>
            <button className={tab === "intake" ? "on" : ""} onClick={() => setTab("intake")}>
              Intake
            </button>
            <button className={tab === "soap" ? "on" : ""} onClick={() => setTab("soap")}>
              SOAP
            </button>
            <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>
              History
            </button>
          </nav>

          {tab === "profile" && (
            <form className="card grid" onSubmit={saveClient}>
              <Field label="First Name" value={clientForm.first_name} onChange={(v) => setClientForm({ ...clientForm, first_name: v })} />
              <Field label="Last Name" value={clientForm.last_name} onChange={(v) => setClientForm({ ...clientForm, last_name: v })} />
              <Field label="Phone" value={clientForm.phone} onChange={(v) => setClientForm({ ...clientForm, phone: v })} />
              <Field label="Email" value={clientForm.email} onChange={(v) => setClientForm({ ...clientForm, email: v })} />
              <Field label="Date of Birth" type="date" value={clientForm.date_of_birth} onChange={(v) => setClientForm({ ...clientForm, date_of_birth: v })} />
              <Field label="Address" value={clientForm.address} onChange={(v) => setClientForm({ ...clientForm, address: v })} />
              <Field label="Emergency Contact" textarea value={clientForm.emergency_contact} onChange={(v) => setClientForm({ ...clientForm, emergency_contact: v })} />
              <Field label="Notes" textarea value={clientForm.notes} onChange={(v) => setClientForm({ ...clientForm, notes: v })} />

              <button className="primary span2">Save Client</button>
            </form>
          )}

          {tab === "intake" && (
            <form className="card grid" onSubmit={saveIntake}>
              <Field label="Form Date" type="date" value={intake.form_date} onChange={(v) => setIntake({ ...intake, form_date: v })} />
              <Field label="Therapist" value={intake.therapist} onChange={(v) => setIntake({ ...intake, therapist: v })} />
              <Field label="Main Reason for Visit" textarea value={intake.main_reason} onChange={(v) => setIntake({ ...intake, main_reason: v })} />
              <Field label="Medical Conditions / Injuries" textarea value={intake.conditions_injuries} onChange={(v) => setIntake({ ...intake, conditions_injuries: v })} />
              <Field label="Medications" textarea value={intake.medications} onChange={(v) => setIntake({ ...intake, medications: v })} />
              <Field label="Allergies" textarea value={intake.allergies} onChange={(v) => setIntake({ ...intake, allergies: v })} />
              <Field label="Areas to Avoid" textarea value={intake.areas_to_avoid} onChange={(v) => setIntake({ ...intake, areas_to_avoid: v })} />
              <Field label="Consent Notes" textarea value={intake.consent_notes} onChange={(v) => setIntake({ ...intake, consent_notes: v })} />

              <button className="primary span2">Save Intake + Open PDF</button>
            </form>
          )}

          {tab === "soap" && (
            <form className="card grid" onSubmit={saveSoap}>
              <Field label="Session Date" type="date" value={soap.session_date} onChange={(v) => setSoap({ ...soap, session_date: v })} />
              <Field label="Therapist" value={soap.therapist} onChange={(v) => setSoap({ ...soap, therapist: v })} />
              <Field label="Subjective" textarea value={soap.subjective} onChange={(v) => setSoap({ ...soap, subjective: v })} />
              <Field label="Objective" textarea value={soap.objective} onChange={(v) => setSoap({ ...soap, objective: v })} />
              <Field label="Assessment" textarea value={soap.assessment} onChange={(v) => setSoap({ ...soap, assessment: v })} />
              <Field label="Plan" textarea value={soap.plan} onChange={(v) => setSoap({ ...soap, plan: v })} />
              <Field label="Techniques Used" textarea value={soap.techniques_used} onChange={(v) => setSoap({ ...soap, techniques_used: v })} />
              <Field label="Session Duration" value={soap.session_duration} onChange={(v) => setSoap({ ...soap, session_duration: v })} />
              <Field label="Next Review" value={soap.next_review} onChange={(v) => setSoap({ ...soap, next_review: v })} />

              <button className="primary span2">Save SOAP + Open PDF</button>
            </form>
          )}

          {tab === "history" && (
            <div className="historyGrid">
              <section className="card">
                <h3>Intake History</h3>
                {intakes.length === 0 && <p>No intake forms yet.</p>}
                {intakes.map((r) => (
                  <article className="record" key={r.id}>
                    <strong>{r.form_date || r.created_at?.slice(0, 10)} · {r.therapist || "-"}</strong>
                    <p>{r.main_reason || "-"}</p>
                    <button onClick={() => setPrintData({ type: "Intake", client: selected, record: r })}>
                      Print / PDF
                    </button>
                  </article>
                ))}
              </section>

              <section className="card">
                <h3>SOAP History</h3>
                {soaps.length === 0 && <p>No SOAP notes yet.</p>}
                {soaps.map((r) => (
                  <article className="record" key={r.id}>
                    <strong>{r.session_date || r.created_at?.slice(0, 10)} · {r.therapist || "-"}</strong>
                    <p><b>S:</b> {r.subjective || "-"}</p>
                    <p><b>O:</b> {r.objective || "-"}</p>
                    <p><b>A:</b> {r.assessment || "-"}</p>
                    <p><b>P:</b> {r.plan || "-"}</p>
                    <button onClick={() => setPrintData({ type: "SOAP", client: selected, record: r })}>
                      Print / PDF
                    </button>
                  </article>
                ))}
              </section>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
