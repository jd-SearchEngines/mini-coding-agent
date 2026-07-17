# Mini Coding Agent

从零实现 Coding Agent 的中文教学系列。每一集都是一个完整、可独立安装和运行的项目快照。

## Episodes

- [Episode 01：Agent 怎么连续思考？从一次模型调用到 SessionRuntime](episode-01/)
- [Episode 02：模型如何操作代码？Tool Protocol × Read Tool](episode-02/)
- Episode 03：即将更新

## 运行 Episode 01

需要 Node.js 20 或更高版本。

```bash
cd episode-01
npm install
npm run dev
```

运行完整检查：

```bash
cd episode-01
npm run check
```

## 仓库结构

```text
mini-coding-agent/
├── README.md
├── LICENSE
├── episode-01/
├── episode-02/
└── episode-03/
```

新一集会保留上一集已经实现的能力，并在独立目录中继续扩展，方便读者切换和比较不同阶段的完整代码。

运行 Episode 02：

```bash
cd episode-02
npm install
npm run demo:episode-02
```

## License

[MIT](LICENSE)
