# SEATVIEW

演唱会现场座位视角模拟器：通过公开建筑资料校准、AI 理解单场 2D 分区图，以及程序参数化建模，为用户提供 2D／3D 选区、具体模拟座位、第一人称视角和手机相机取景。

**继续开发前请先阅读 [PROJECT.md](./PROJECT.md)。** 该文档包含项目目标、完整建模过程、默认样本、当前真实完成度、数据设计、验收结果和后续开发约束。

## 快速运行

```bash
npm ci
npm run dev
```

开发服务位于 `http://localhost:3000`。

```bash
npm run check
npm run build
npm start
```

完整环境变量、Supabase 与 Vercel 说明见 `PROJECT.md` 附录。不要将 `.env`、Supabase 服务端密钥、模型密钥或搜索密钥提交到仓库。
