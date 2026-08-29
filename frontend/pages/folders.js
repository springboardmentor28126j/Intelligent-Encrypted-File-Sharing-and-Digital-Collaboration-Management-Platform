import Layout from "../components/Layout";

export default function Folders() {
  return (
    <Layout active="folders" eyebrow="Secure file sharing" title="Folders">
      <div
        style={{
          background: "var(--card)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          padding: 40,
          textAlign: "center",
          color: "var(--text-muted)",
        }}
      >
        Folder organization is coming in a later milestone.
      </div>
    </Layout>
  );
}
