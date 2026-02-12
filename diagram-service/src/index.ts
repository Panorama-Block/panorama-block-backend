import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.DIAGRAM_PORT || 3010;

app.use(express.json({ limit: "5mb" }));
app.use(cors());

// GET /diagram — retorna o diagrama default (ou cria se não existe)
app.get("/diagram", async (_req, res) => {
  try {
    let diagram = await prisma.diagram.findUnique({ where: { name: "default" } });
    if (!diagram) {
      diagram = await prisma.diagram.create({
        data: { name: "default", nodes: [], edges: [] },
      });
    }
    res.json(diagram);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /diagram — salva nodes + edges
app.put("/diagram", async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    if (!nodes || !edges) {
      return res.status(400).json({ error: "nodes and edges required" });
    }
    const diagram = await prisma.diagram.upsert({
      where: { name: "default" },
      update: { nodes, edges },
      create: { name: "default", nodes, edges },
    });
    res.json(diagram);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /diagram/seed — seed com dados iniciais
app.post("/diagram/seed", async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    const existing = await prisma.diagram.findUnique({ where: { name: "default" } });
    if (existing) {
      return res.json({ message: "already seeded", diagram: existing });
    }
    const diagram = await prisma.diagram.create({
      data: { name: "default", nodes: nodes || [], edges: edges || [] },
    });
    res.json(diagram);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Diagram service running on port ${PORT}`);
});
