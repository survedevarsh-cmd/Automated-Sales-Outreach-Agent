import styles from "./page.module.css";
import AgentDashboard from "../components/AgentDashboard";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={`${styles.hero} animate-fade-in`}>
        <div className={styles.statusIndicator} style={{ marginBottom: '1.5rem', width: '12px', height: '12px' }}></div>
        <h1 className={styles.title}>
          Automated <span className="text-gradient">Sales Outreach</span> Agent
        </h1>
        <p className={styles.subtitle}>
          Stop wasting hours on manual prospecting. Let our AI agent analyze, research, 
          and draft highly personalized outreach sequences in seconds.
        </p>
      </div>

      <AgentDashboard />
    </main>
  );
}
