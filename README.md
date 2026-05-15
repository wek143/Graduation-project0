# 自动评测系统 (Auto Grading System)

基于 Spring Boot + Vue 3 的在线编程作业自动评测平台，支持代码自动判题、AI 诊断与多角色管理。

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Spring Boot 3.3.5, Spring Data JPA, Spring WebFlux, Flyway, MySQL / H2 |
| 前端 | Vue 3 (Composition API), Vite, Pinia, Vue Router |
| AI   | DeepSeek API（代码诊断） |
| 构建 | Maven, npm |

## 功能概览

- **多角色权限**：管理员、教师、学生三种角色，各自独立视图
- **课程管理**：创建课程、学生选课与退课
- **作业管理**：发布作业、配置测试用例、设置截止时间
- **自动判题**：提交 Java 代码后自动编译运行，逐用例比对输出
- **AI 诊断**：调用 DeepSeek 对错误提交给出修改建议
- **提交历史**：查看历次提交记录与评测详情

## 快速启动

### 前置条件

- JDK 17+
- Node.js 18+
- Maven 3.8+

### 一键启动（Windows）

```bat
start.bat
```

启动后访问：
- 前端：http://localhost:5173
- 后端 API：http://localhost:8080

> 默认使用 `demo` Profile，内置 H2 内存数据库，无需额外配置数据库。

### 手动启动

```bash
# 后端
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=demo

# 前端（新终端）
cd frontend
npm install
npm run dev
```

## 项目结构

```
.
├── backend/                        # Spring Boot 后端
│   └── src/main/java/.../
│       ├── controller/             # REST 接口
│       ├── service/                # 业务逻辑
│       ├── domain/                 # JPA 实体
│       ├── judge/                  # 判题引擎
│       └── auth/                   # 认证授权
├── frontend/                       # Vue 3 前端
│   └── src/
│       ├── views/                  # 页面（Admin / Teacher / Student）
│       ├── components/             # 可复用组件
│       ├── stores/                 # Pinia 状态
│       └── api/                    # 接口调用
└── start.bat                       # 一键启动脚本
```

## 生产环境配置

修改 [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml) 中的数据库连接：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/autograding
    username: your_username
    password: your_password
```

去掉启动命令中的 `-Dspring-boot.run.profiles=demo` 即可使用 MySQL。

## 运行测试

```bash
cd backend
mvn test
```

## 默认账号（Demo 模式）

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin1 | 123456 |
| 教师 | teacher1 | 123456 |
| 学生 | student1 | 123456 |
