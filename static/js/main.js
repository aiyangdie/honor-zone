// 全局变量
let currentZoneId = null;

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 加载战区列表
    loadZones();
    
    // 绑定表单提交事件
    document.getElementById('create-user-form').addEventListener('submit', createUser);
    document.getElementById('update-score-form').addEventListener('submit', updateScore);
    
    // 绑定战区选择变化事件
    document.getElementById('zone-select').addEventListener('change', function() {
        currentZoneId = this.value;
        if (currentZoneId) {
            loadLeaderboard(currentZoneId);
            document.getElementById('zone-name').textContent = this.options[this.selectedIndex].text;
        }
    });
});

// 加载战区列表
async function loadZones() {
    try {
        // 模拟API调用，实际项目中应该从后端获取数据
        const response = await fetch('/api/zones');
        const data = await response.json();
        
        if (data.status === 'success') {
            populateZoneSelects(data.data);
        } else {
            showMessage('加载战区失败: ' + data.message, true);
        }
    } catch (error) {
        console.error('加载战区出错:', error);
        showMessage('加载战区出错，请检查网络连接', true);
        
        // 添加一些测试数据，以便在API不可用时也能展示界面
        const testZones = [
            { id: 1, name: '荣耀战区' },
            { id: 2, name: '王者战区' },
            { id: 3, name: '无双战区' }
        ];
        populateZoneSelects({ zones: testZones });
    }
}

// 填充战区选择框
function populateZoneSelects(data) {
    const zoneSelect = document.getElementById('zone-select');
    const userZoneSelect = document.getElementById('user-zone');
    
    // 清空现有选项
    zoneSelect.innerHTML = '';
    userZoneSelect.innerHTML = '';
    
    // 添加默认选项
    zoneSelect.appendChild(new Option('请选择战区', ''));
    userZoneSelect.appendChild(new Option('请选择战区', ''));
    
    // 添加战区选项
    data.zones.forEach(zone => {
        zoneSelect.appendChild(new Option(zone.name, zone.id));
        userZoneSelect.appendChild(new Option(zone.name, zone.id));
    });
    
    // 如果有战区，默认选择第一个并加载排行榜
    if (data.zones.length > 0) {
        currentZoneId = data.zones[0].id;
        zoneSelect.value = currentZoneId;
        document.getElementById('zone-name').textContent = data.zones[0].name;
        loadLeaderboard(currentZoneId);
    }
}

// 加载排行榜数据
async function loadLeaderboard(zoneId) {
    const leaderboardBody = document.getElementById('leaderboard-body');
    leaderboardBody.innerHTML = '<tr><td colspan="4" class="loading">加载中...</td></tr>';
    
    try {
        // 从API获取排行榜数据
        const response = await fetch(`/api/leaderboard/zone/${zoneId}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            displayLeaderboard(data.data.leaderboard);
        } else {
            showMessage('加载排行榜失败: ' + data.message, true);
            leaderboardBody.innerHTML = '<tr><td colspan="4" class="loading">加载失败</td></tr>';
        }
    } catch (error) {
        console.error('加载排行榜出错:', error);
        showMessage('加载排行榜出错，请检查网络连接', true);
        
        // 添加一些测试数据，以便在API不可用时也能展示界面
        const testData = [
            { rank: 1, user_id: 101, nickname: '最强王者', avatar_url: 'https://game.gtimg.cn/images/yxzj/img201606/heroimg/166/166.jpg', score: 9800 },
            { rank: 2, user_id: 102, nickname: '荣耀王者', avatar_url: 'https://game.gtimg.cn/images/yxzj/img201606/heroimg/107/107.jpg', score: 8500 },
            { rank: 3, user_id: 103, nickname: '无双王者', avatar_url: 'https://game.gtimg.cn/images/yxzj/img201606/heroimg/131/131.jpg', score: 7200 },
            { rank: 4, user_id: 104, nickname: '超凡大师', avatar_url: 'https://game.gtimg.cn/images/yxzj/img201606/heroimg/142/142.jpg', score: 6800 },
            { rank: 5, user_id: 105, nickname: '璀璨钻石', avatar_url: 'https://game.gtimg.cn/images/yxzj/img201606/heroimg/157/157.jpg', score: 5500 }
        ];
        displayLeaderboard(testData);
    }
}

// 显示排行榜数据
function displayLeaderboard(leaderboardData) {
    const leaderboardBody = document.getElementById('leaderboard-body');
    leaderboardBody.innerHTML = '';
    
    if (!leaderboardData || leaderboardData.length === 0) {
        leaderboardBody.innerHTML = '<tr><td colspan="4" class="loading">暂无排行数据</td></tr>';
        return;
    }
    
    leaderboardData.forEach(item => {
        const row = document.createElement('tr');
        
        // 排名列，前三名有特殊样式
        const rankCell = document.createElement('td');
        rankCell.textContent = item.rank;
        if (item.rank <= 3) {
            rankCell.className = `rank-${item.rank}`;
        }
        row.appendChild(rankCell);
        
        // 头像列
        const avatarCell = document.createElement('td');
        const avatar = document.createElement('img');
        avatar.src = item.avatar_url || 'https://game.gtimg.cn/images/yxzj/web201706/images/comm/default_head.png';
        avatar.alt = item.nickname;
        avatar.className = 'user-avatar';
        avatarCell.appendChild(avatar);
        row.appendChild(avatarCell);
        
        // 昵称列
        const nicknameCell = document.createElement('td');
        nicknameCell.textContent = item.nickname;
        row.appendChild(nicknameCell);
        
        // 积分列
        const scoreCell = document.createElement('td');
        scoreCell.textContent = item.score;
        row.appendChild(scoreCell);
        
        leaderboardBody.appendChild(row);
    });
}

// 创建用户
async function createUser(event) {
    event.preventDefault();
    
    const nickname = document.getElementById('nickname').value.trim();
    const avatarUrl = document.getElementById('avatar-url').value.trim();
    const zoneId = document.getElementById('user-zone').value;
    
    if (!nickname) {
        showMessage('昵称不能为空', true);
        return;
    }
    
    const userData = {
        nickname: nickname,
        avatar_url: avatarUrl || undefined,
        current_zone_id: zoneId ? parseInt(zoneId) : 0
    };
    
    try {
        // 发送创建用户请求
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showMessage(`用户 ${nickname} 创建成功，ID: ${data.data.id}`);
            document.getElementById('create-user-form').reset();
            
            // 如果创建的用户与当前选择的战区相同，刷新排行榜
            if (zoneId && parseInt(zoneId) === parseInt(currentZoneId)) {
                loadLeaderboard(currentZoneId);
            }
        } else {
            showMessage('创建用户失败: ' + data.message, true);
        }
    } catch (error) {
        console.error('创建用户出错:', error);
        showMessage('创建用户出错，请检查网络连接', true);
    }
}

// 更新积分
async function updateScore(event) {
    event.preventDefault();
    
    const userId = document.getElementById('user-id').value.trim();
    const score = document.getElementById('score').value.trim();
    
    if (!userId || !score) {
        showMessage('用户ID和积分不能为空', true);
        return;
    }
    
    const scoreData = {
        user_id: parseInt(userId),
        score: parseInt(score)
    };
    
    try {
        // 发送更新积分请求
        const response = await fetch('/api/scores/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scoreData)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showMessage(`用户 ${userId} 积分更新成功，新积分: ${data.data.new_score}`);
            document.getElementById('update-score-form').reset();
            
            // 刷新当前排行榜
            if (currentZoneId) {
                loadLeaderboard(currentZoneId);
            }
        } else {
            showMessage('更新积分失败: ' + data.message, true);
        }
    } catch (error) {
        console.error('更新积分出错:', error);
        showMessage('更新积分出错，请检查网络连接', true);
    }
}

// 显示消息提示
function showMessage(message, isError = false) {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    
    messageText.textContent = message;
    messageBox.className = isError ? 'message-box error show' : 'message-box show';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        messageBox.className = 'message-box';
    }, 3000);
}