import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { Chart as ChartJS, 
  LineController, LineElement, PointElement, 
  LinearScale, CategoryScale, Title, BarController, 
  BarElement, PieController, ArcElement, 
  RadarController, RadialLinearScale 
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import CalendarButton from '../CalendarButton/CalendarButton';
import styles from './Profile.module.css';
import { formatTimestamp } from '../../utils/adminActions';
import PropTypes from 'prop-types';
import { useAuth, useTournament, useUserPreferences, useNameOptions } from '../../contexts';

// Register Chart.js components
ChartJS.register(
  LineController, LineElement, BarController, BarElement,
  PieController, ArcElement, PointElement, LinearScale,
  CategoryScale, Title, RadarController, RadialLinearScale
);

// Constants and Configurations
const SORT_CONFIG = {
  individual: [
    { key: 'rating', label: 'Rating' },
    { key: 'name', label: 'Name' },
    { key: 'wins', label: 'Wins' },
    { key: 'losses', label: 'Losses' },
    { key: 'updated_at', label: 'Last Updated' }
  ],
  aggregated: [
    { key: 'avgRating', label: 'Average Rating' },
    { key: 'totalRatings', label: 'Times Rated' },
    { key: 'name', label: 'Name' },
    { key: 'totalWins', label: 'Total Wins' },
    { key: 'totalLosses', label: 'Total Losses' }
  ]
};

const TIME_FILTERS = ['All Time', 'Today', 'This Week', 'This Month'];
export const DEFAULT_RATING = 1500;
const ACTIVE_THRESHOLD = 3600000; // 1 hour in milliseconds

// Add new constants for filtering
const FILTER_OPTIONS = {
  STATUS: {
    ALL: 'all',
    ACTIVE: 'active',
    HIDDEN: 'hidden'
  },
  SORT: {
    RATING: 'rating',
    WORST_RATING: 'worst_rating',
    NAME: 'name',
    LAST_UPDATED: 'updated_at',
    MATCHES: 'matches'
  }
};

// Reusable Components
const Button = memo(({ onClick, className, disabled, children, variant = 'default', ...props }) => (
  <button
    onClick={onClick}
    className={`${styles.button} ${styles[variant]} ${className || ''}`}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
));

const Modal = memo(({ title, isOpen, onClose, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
});

const Card = memo(({ className, children, ...props }) => (
  <div className={`${styles.card} ${className || ''}`} {...props}>
    {children}
  </div>
));

const StatsCard = memo(({ label, value, emoji }) => (
  <Card className={styles.statItem}>
    <span className={styles.statLabel}>{label}</span>
    <span className={styles.statValue}>{value}</span>
    {emoji && <span className={styles.statEmoji}>{emoji}</span>}
  </Card>
));

// Utility Functions
const calculateStats = (ratings, filterStatus = FILTER_OPTIONS.STATUS.ALL) => {
  const filteredRatings = ratings.filter(r => {
    if (filterStatus === FILTER_OPTIONS.STATUS.ACTIVE) return !r.isHidden;
    if (filterStatus === FILTER_OPTIONS.STATUS.HIDDEN) return r.isHidden;
    return true;
  });

  const totalNames = filteredRatings.length;
  const totalMatches = filteredRatings.reduce((sum, r) => sum + (r.wins || 0) + (r.losses || 0), 0);
  const averageRating = totalNames > 0 
    ? Math.round(filteredRatings.reduce((sum, r) => sum + (r.rating || DEFAULT_RATING), 0) / totalNames) 
    : 0;
  
  return {
    totalNames,
    averageRating,
    totalMatches,
    winRate: totalMatches > 0 
      ? Math.round((filteredRatings.reduce((sum, r) => sum + (r.wins || 0), 0) / totalMatches) * 100)
      : 0,
    activeNames: ratings.filter(r => !r.isHidden).length,
    hiddenNames: ratings.filter(r => r.isHidden).length
  };
};

const processUserRatings = (data) => {
  const lastActivity = {};
  const ratingsByUser = {};

  if (!data) return { lastActivity, ratingsByUser };

  data.forEach(item => {
    if (!item.name_options) return;
    
    const userName = item.user_name;
    
    // Update last activity
    if (!lastActivity[userName] || new Date(item.updated_at) > new Date(lastActivity[userName])) {
      lastActivity[userName] = item.updated_at;
    }
    
    // Process ratings
    if (!ratingsByUser[userName]) {
      ratingsByUser[userName] = [];
    }
    
    ratingsByUser[userName].push({
      id: item.name_options.id,
      name: item.name_options.name,
      description: item.name_options.description,
      rating: parseInt(item.rating || DEFAULT_RATING, 10),
      wins: parseInt(item.wins || 0, 10),
      losses: parseInt(item.losses || 0, 10),
      updated_at: item.updated_at || new Date().toISOString()
    });
  });

  return { lastActivity, ratingsByUser };
};

// Subcomponents
const ProfileStats = memo(({ ratings, filterStatus }) => {
  const stats = useMemo(() => calculateStats(ratings, filterStatus), [ratings, filterStatus]);

  return (
    <div className={styles.statsContainer}>
      <StatsCard 
        label={filterStatus === FILTER_OPTIONS.STATUS.ALL ? "Total Names" : "Filtered Names"} 
        value={stats.totalNames} 
        emoji="📝" 
      />
      <StatsCard label="Average Rating" value={stats.averageRating} emoji="⭐" />
      <StatsCard label="Total Matches" value={stats.totalMatches} emoji="🎮" />
      <StatsCard label="Win Rate" value={`${stats.winRate}%`} emoji="🏆" />
      {filterStatus === FILTER_OPTIONS.STATUS.ALL && (
        <>
          <StatsCard label="Active Names" value={stats.activeNames} emoji="✅" />
          <StatsCard label="Hidden Names" value={stats.hiddenNames} emoji="🔒" />
        </>
      )}
    </div>
  );
});

const NameCard = memo(({ 
  name, 
  isHidden, 
  onToggleVisibility, 
  onDelete, 
  isAdmin, 
  isAggregated = false 
}) => {
  const {
    id,
    name: nameText,
    rating = DEFAULT_RATING,
    wins = 0,
    losses = 0,
    averageRating,
    totalVotes,
    userCount,
    updated_at
  } = name;

  const displayRating = isAggregated ? averageRating : rating;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return (
    <Card className={`${styles.nameCard} ${isHidden ? styles.isHidden : ''}`}>
      <div className={styles.nameHeader}>
        <h3 className={styles.nameTitle}>{nameText}</h3>
        <div className={styles.rating}>
          {displayRating.toLocaleString()}
          {isAggregated && <span className={styles.ratingLabel}> avg</span>}
        </div>
      </div>
      
      <div className={styles.stats}>
        <div className={styles.record}>
          <span className={styles.wins}>{wins} wins</span>
          <span className={styles.separator}>•</span>
          <span className={styles.losses}>{losses} losses</span>
          {totalMatches > 0 && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.winRate}>{winRate}% win rate</span>
            </>
          )}
        </div>
        
        <div className={styles.additionalStats}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Total Matches:</span>
            <span className={styles.statValue}>{totalMatches}</span>
          </div>
          {isAggregated ? (
            <>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Times Rated:</span>
                <span className={styles.statValue}>{totalVotes}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Users:</span>
                <span className={styles.statValue}>{userCount}</span>
              </div>
            </>
          ) : (
            updated_at && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Last Updated:</span>
                <span className={styles.statValue}>{formatTimestamp(updated_at)}</span>
              </div>
            )
          )}
        </div>
      </div>

      {isAdmin && (
        <div className={styles.cardActions}>
          <button
            onClick={() => onToggleVisibility(id, nameText)}
            className={`${styles.visibilityToggle} ${isHidden ? styles.hidden : ''}`}
            aria-label={`${isHidden ? 'Show' : 'Hide'} ${nameText}`}
          >
            <span className={styles.visibilityIcon}>
              {isHidden ? '🔒' : '🔓'}
            </span>
            <span>{isHidden ? 'Hidden' : 'Hide'}</span>
          </button>
          {isHidden && (
            <button
              onClick={() => onDelete(name)}
              className={`${styles.button} ${styles.delete}`}
              aria-label={`Delete ${nameText}`}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      )}

      {isHidden && (
        <div className={styles.hiddenStatus}>
          <p className={styles.hiddenText}>This name is hidden from tournaments</p>
        </div>
      )}
    </Card>
  );
});

const UserCard = memo(({ user, onUserAction, isActive }) => (
  <Card 
    className={`${styles.userCard} ${isActive ? styles.active : ''}`}
    onClick={() => onUserAction('view', user)}
  >
    <div className={styles.userInfo}>
      <span className={styles.userName}>{user.name}</span>
      <div className={styles.userStats}>
        <div className={styles.userStat}>
          <span className={styles.userStatLabel}>Names Rated</span>
          <span className={styles.userStatValue}>{user.ratingsCount}</span>
        </div>
        <div className={styles.userStat}>
          <span className={styles.userStatLabel}>Average Rating</span>
          <span className={styles.userStatValue}>{Math.round(user.averageRating)}</span>
        </div>
      </div>
      <span className={styles.lastActive}>{formatTimestamp(user.lastActive)}</span>
    </div>
    {isActive && (
      <div className={styles.userActions}>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onUserAction('export', user);
          }}
        >
          Export
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onUserAction('delete', user);
          }}
          variant="delete"
        >
          Delete
        </Button>
      </div>
    )}
  </Card>
));

const AdminPanel = ({ users, onRefresh }) => {
  const [isMinimized, setIsMinimized] = useState(true);
  const [activeTimeFilter, setActiveTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastActive');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredAndSortedUsers = useMemo(() => {
    // First apply time filter
    let filtered = users;
    if (activeTimeFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (activeTimeFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'thisWeek':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'thisMonth':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }

      filtered = users.filter(user => {
        const lastActiveDate = new Date(user.lastActive);
        return lastActiveDate >= filterDate;
      });
    }

    // Then sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'ratingsCount':
          comparison = b.ratingsCount - a.ratingsCount;
          break;
        case 'averageRating':
          comparison = b.averageRating - a.averageRating;
          break;
        case 'lastActive':
          comparison = new Date(b.lastActive) - new Date(a.lastActive);
          break;
        default:
          return 0;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });
  }, [users, activeTimeFilter, sortBy, sortOrder]);

  return (
    <div className={`${styles.adminPanel} ${isMinimized ? styles.minimized : ''}`}>
      <div className={styles.adminHeader}>
        <h2>
          Admin Dashboard
          <span className={styles.sectionSubtitle}>
            {users.length} users registered
          </span>
        </h2>
        <div className={styles.headerControls}>
          <button
            className={`${styles.minimizeButton} ${isMinimized ? styles.minimized : ''}`}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expand dashboard" : "Minimize dashboard"}
          >
            {isMinimized ? "▼" : "▲"}
          </button>
        </div>
      </div>
      
      <div className={styles.adminControls}>
        <div className={styles.controls}>
          {TIME_FILTERS.map(filter => (
            <Button 
              key={filter}
              onClick={() => setActiveTimeFilter(filter.toLowerCase())}
              variant={filter.toLowerCase() === activeTimeFilter ? 'primary' : 'default'}
            >
              {filter}
            </Button>
          ))}
        </div>
        <div className={styles.sortControls}>
          <span className={styles.sortLabel}>Sort by:</span>
          <select 
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="lastActive">Last Active</option>
            <option value="name">Name</option>
            <option value="ratingsCount">Names Rated</option>
            <option value="averageRating">Average Rating</option>
          </select>
          <Button
            onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
            variant="default"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      <div className={styles.userList}>
        {filteredAndSortedUsers.map(user => (
          <UserCard 
            key={user.id} 
            user={user} 
            onUserAction={onRefresh}
            isActive={user.name === activeTimeFilter}
          />
        ))}
      </div>
    </div>
  );
};

const CHART_METRICS = {
  RATING: {
    key: 'rating',
    label: 'Rating',
    field: 'averageRating',
    color: 'rgba(75, 192, 192, 0.6)',
    borderColor: 'rgba(75, 192, 192, 1)'
  },
  WIN_RATE: {
    key: 'winRate',
    label: 'Win Rate %',
    field: 'winRate',
    color: 'rgba(16, 185, 129, 0.6)',
    borderColor: 'rgb(16, 185, 129)'
  },
  TOTAL_MATCHES: {
    key: 'matches',
    label: 'Total Matches',
    field: 'totalMatches',
    color: 'rgba(99, 102, 241, 0.6)',
    borderColor: 'rgb(99, 102, 241)'
  },
  TIMES_RATED: {
    key: 'timesRated',
    label: 'Times Rated',
    field: 'totalVotes',
    color: 'rgba(244, 114, 182, 0.6)',
    borderColor: 'rgb(244, 114, 182)'
  }
};

const ChartControls = memo(({ onMetricChange, currentMetric }) => (
  <div className={styles.chartControls}>
    <label className={styles.chartLabel}>Metric:</label>
    <select 
      value={currentMetric}
      onChange={(e) => onMetricChange(e.target.value)}
      className={styles.chartSelect}
    >
      {Object.values(CHART_METRICS).map(metric => (
        <option key={metric.key} value={metric.key}>
          {metric.label}
        </option>
      ))}
    </select>
  </div>
));

const ChartSection = memo(({ aggregatedNames, filterStatus }) => {
  const [metric, setMetric] = useState(CHART_METRICS.RATING.key);
  const currentMetric = CHART_METRICS[Object.keys(CHART_METRICS).find(k => 
    CHART_METRICS[k].key === metric
  )];

  const chartData = useMemo(() => {
    const topNames = aggregatedNames.slice(0, 10);

    return {
      labels: topNames.map(n => n.name),
      datasets: [
        {
          label: currentMetric.label,
          data: topNames.map(n => n[currentMetric.field]),
          backgroundColor: topNames.map(n => 
            n.isHidden ? 'rgba(156, 156, 156, 0.6)' : currentMetric.color
          ),
          borderColor: topNames.map(n => 
            n.isHidden ? 'rgba(156, 156, 156, 1)' : currentMetric.borderColor
          ),
          borderWidth: 1,
        }
      ]
    };
  }, [aggregatedNames, currentMetric]);

  // Calculate rating distribution for pie chart
  const ratingDistribution = useMemo(() => {
    const distribution = {
      'Elite (1800+)': 0,
      'Strong (1650-1799)': 0,
      'Good (1500-1649)': 0,
      'Average (1350-1499)': 0,
      'Developing (<1350)': 0
    };

    aggregatedNames.forEach(name => {
      if (name.averageRating >= 1800) distribution['Elite (1800+)']++;
      else if (name.averageRating >= 1650) distribution['Strong (1650-1799)']++;
      else if (name.averageRating >= 1500) distribution['Good (1500-1649)']++;
      else if (name.averageRating >= 1350) distribution['Average (1350-1499)']++;
      else distribution['Developing (<1350)']++;
    });

    return {
      labels: Object.keys(distribution),
      datasets: [{
        data: Object.values(distribution),
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',   // Elite - Indigo
          'rgba(16, 185, 129, 0.8)',   // Strong - Green
          'rgba(245, 158, 11, 0.8)',   // Good - Amber
          'rgba(59, 130, 246, 0.8)',   // Average - Blue
          'rgba(156, 163, 175, 0.8)',  // Developing - Gray
        ],
        borderColor: [
          'rgb(99, 102, 241)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(59, 130, 246)',
          'rgb(156, 163, 175)',
        ],
        borderWidth: 1
      }]
    };
  }, [aggregatedNames]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Top 10 Cat Names by ${currentMetric.label} - ${
          filterStatus === FILTER_OPTIONS.STATUS.ALL ? 'All' : 
          filterStatus === FILTER_OPTIONS.STATUS.ACTIVE ? 'Active' : 'Hidden'
        } Names`,
        color: 'var(--text-primary)',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        position: 'top',
        labels: {
          color: 'var(--text-primary)'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const name = context.chart.data.labels[context.dataIndex];
            const value = context.raw;
            const nameData = aggregatedNames.find(n => n.name === name);
            const label = `${currentMetric.label}: ${value}${
              currentMetric.key === 'winRate' ? '%' : ''
            }`;
            return `${label}${nameData?.isHidden ? ' (Hidden)' : ''}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'var(--border-color)'
        },
        ticks: {
          color: 'var(--text-secondary)',
          callback: (value) => currentMetric.key === 'winRate' ? `${value}%` : value
        },
        title: {
          display: true,
          text: currentMetric.label,
          color: 'var(--text-primary)'
        }
      },
      x: {
        grid: {
          color: 'var(--border-color)'
        },
        ticks: {
          color: 'var(--text-secondary)',
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  return (
    <div className={styles.chartsContainer}>
      <div className={styles.chartHeader}>
        <ChartControls 
          onMetricChange={setMetric}
          currentMetric={metric}
        />
      </div>
      <div className={styles.chartRow}>
        <div className={styles.chartWrapper}>
          <Bar data={chartData} options={chartOptions} />
        </div>
        <div className={styles.pieChartWrapper}>
          <Pie 
            data={ratingDistribution} 
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  ...chartOptions.plugins.title,
                  text: `Rating Distribution - ${
                    filterStatus === FILTER_OPTIONS.STATUS.ALL ? 'All' : 
                    filterStatus === FILTER_OPTIONS.STATUS.ACTIVE ? 'Active' : 'Hidden'
                  } Names`
                }
              }
            }} 
          />
        </div>
      </div>
    </div>
  );
});

const calculateAggregatedStats = (nameOptions) => {
  const stats = nameOptions.reduce((acc, name) => {
    const rating = name.cat_name_ratings?.[0] || {};
    const wins = parseInt(rating.wins || 0, 10);
    const losses = parseInt(rating.losses || 0, 10);
    const currentRating = parseInt(rating.rating || DEFAULT_RATING, 10);
    
    acc.totalMatches += wins + losses;
    acc.totalWins += wins;
    acc.totalLosses += losses;
    acc.totalRatings++;
    acc.avgRating = (acc.avgRating * (acc.totalRatings - 1) + currentRating) / acc.totalRatings;
    
    if (currentRating > acc.highestRating) {
      acc.highestRating = currentRating;
      acc.bestName = name.name;
    }
    if (currentRating < acc.lowestRating || acc.lowestRating === null) {
      acc.lowestRating = currentRating;
      acc.worstName = name.name;
    }
    
    return acc;
  }, {
    totalMatches: 0,
    totalWins: 0,
    totalLosses: 0,
    totalRatings: 0,
    avgRating: 0,
    highestRating: -Infinity,
    lowestRating: null,
    bestName: '',
    worstName: ''
  });

  return stats;
};

const AggregatedStats = memo(({ nameOptions }) => {
  const stats = useMemo(() => calculateAggregatedStats(nameOptions), [nameOptions]);
  
  return (
    <div className={styles.aggregatedStats}>
      <h3>Overall Statistics</h3>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h4>Total Matches</h4>
          <p>{stats.totalMatches}</p>
        </div>
        <div className={styles.statCard}>
          <h4>Win Rate</h4>
          <p>{((stats.totalWins / stats.totalMatches) * 100 || 0).toFixed(1)}%</p>
        </div>
        <div className={styles.statCard}>
          <h4>Average Rating</h4>
          <p>{Math.round(stats.avgRating)}</p>
        </div>
        <div className={styles.statCard}>
          <h4>Best Name</h4>
          <p>{stats.bestName} ({stats.highestRating})</p>
        </div>
        <div className={styles.statCard}>
          <h4>Worst Name</h4>
          <p>{stats.worstName} ({stats.lowestRating})</p>
        </div>
      </div>
    </div>
  );
});

AggregatedStats.propTypes = {
  nameOptions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    cat_name_ratings: PropTypes.arrayOf(PropTypes.shape({
      rating: PropTypes.number,
      wins: PropTypes.number,
      losses: PropTypes.number
    }))
  })).isRequired
};

// New FilterControls component
const FilterControls = memo(({ onFilterChange, onSortChange, currentFilter, currentSort }) => (
  <div className={styles.filterControls}>
    <div className={styles.filterGroup}>
      <label className={styles.filterLabel}>Status:</label>
      <select 
        value={currentFilter} 
        onChange={(e) => onFilterChange(e.target.value)}
        className={styles.filterSelect}
      >
        <option value={FILTER_OPTIONS.STATUS.ALL}>All Names</option>
        <option value={FILTER_OPTIONS.STATUS.ACTIVE}>Active Names</option>
        <option value={FILTER_OPTIONS.STATUS.HIDDEN}>Hidden Names</option>
      </select>
    </div>
    <div className={styles.filterGroup}>
      <label className={styles.filterLabel}>Sort by:</label>
      <select 
        value={currentSort} 
        onChange={(e) => onSortChange(e.target.value)}
        className={styles.filterSelect}
      >
        <option value={FILTER_OPTIONS.SORT.RATING}>Best Rating</option>
        <option value={FILTER_OPTIONS.SORT.WORST_RATING}>Worst Rating</option>
        <option value={FILTER_OPTIONS.SORT.NAME}>Name</option>
        <option value={FILTER_OPTIONS.SORT.MATCHES}>Total Matches</option>
      </select>
    </div>
  </div>
));

// Enhanced chart data preparation
const prepareChartData = (nameOptions, filterStatus) => {
  const filteredNames = nameOptions.filter(name => {
    const rating = name.cat_name_ratings?.[0] || {};
    switch (filterStatus) {
      case FILTER_OPTIONS.STATUS.HIDDEN:
        return name.isHidden;
      case FILTER_OPTIONS.STATUS.ACTIVE:
        return !name.isHidden;
      default:
        return true;
    }
  });

  const sortedNames = [...filteredNames].sort((a, b) => {
    const aRating = a.cat_name_ratings?.[0]?.rating || DEFAULT_RATING;
    const bRating = b.cat_name_ratings?.[0]?.rating || DEFAULT_RATING;
    return bRating - aRating;
  });

  return {
    labels: sortedNames.map(n => n.name),
    datasets: [
      {
        label: 'Rating',
        data: sortedNames.map(n => n.cat_name_ratings?.[0]?.rating || DEFAULT_RATING),
        backgroundColor: sortedNames.map(n => 
          n.isHidden ? 'rgba(156, 156, 156, 0.6)' : 'rgba(75, 192, 192, 0.6)'
        ),
        borderColor: sortedNames.map(n => 
          n.isHidden ? 'rgba(156, 156, 156, 1)' : 'rgba(75, 192, 192, 1)'
        ),
        borderWidth: 1
      }
    ]
  };
};

// Main Component
const Profile = () => {
  const { userName } = useAuth();
  const { preferences, updatePreferences } = useUserPreferences();
  const { 
    nameOptions, 
    isLoading, 
    error,
    updateRating,
    hideNameOption,
    refreshNameOptions,
    removeNameOption 
  } = useNameOptions();
  
  // State
  const [isAdmin] = useState(userName.toLowerCase() === 'aaron');
  const [viewMode, setViewMode] = useState(preferences?.viewMode || 'individual');
  const [showDeleteNameConfirm, setShowDeleteNameConfirm] = useState(false);
  const [nameToDelete, setNameToDelete] = useState(null);
  const [deleteNameStatus, setDeleteNameStatus] = useState({ loading: false, error: null });
  const [currentlyViewedUser, setCurrentlyViewedUser] = useState(userName);
  const [showAggregated, setShowAggregated] = useState(false);
  const [filterStatus, setFilterStatus] = useState(preferences?.filterStatus || FILTER_OPTIONS.STATUS.ACTIVE);
  const [sortBy, setSortBy] = useState(preferences?.sortPreference || FILTER_OPTIONS.SORT.RATING);

  // Update preferences when view settings change
  useEffect(() => {
    if (!preferences) return;
    
    updatePreferences({
      viewMode,
      filterStatus,
      sortPreference: sortBy
    });
  }, [viewMode, filterStatus, sortBy, preferences, updatePreferences]);

  const handleUserAction = useCallback(async (action, user) => {
    if (action === 'view') {
      setCurrentlyViewedUser(user.name);
    }
  }, []);

  const handleToggleNameVisibility = useCallback(async (nameId) => {
    try {
      await hideNameOption(nameId);
      await refreshNameOptions();
    } catch (err) {
      console.error('Error toggling name visibility:', err);
    }
  }, [hideNameOption, refreshNameOptions]);

  const handleDeleteName = useCallback(async (nameId) => {
    try {
      setDeleteNameStatus({ loading: true, error: null });
      await removeNameOption(nameId);
      setShowDeleteNameConfirm(false);
      await refreshNameOptions();
    } catch (err) {
      setDeleteNameStatus({ loading: false, error: err.message });
    }
  }, [removeNameOption, refreshNameOptions]);

  const handleUpdateRating = useCallback(async (nameId, newRating) => {
    try {
      const name = nameOptions.find(n => n.id === nameId);
      if (!name) return;
      
      const currentRating = name.cat_name_ratings?.[0] || {};
      await updateRating(nameId, {
        rating: newRating,
        wins: currentRating.wins || 0,
        losses: currentRating.losses || 0
      });
      await refreshNameOptions();
    } catch (err) {
      console.error('Error updating rating:', err);
    }
  }, [nameOptions, updateRating, refreshNameOptions]);

  const sortedRatings = useMemo(() => {
    return [...nameOptions].sort((a, b) => {
      const aRating = a.cat_name_ratings?.[0] || {};
      const bRating = b.cat_name_ratings?.[0] || {};
      
      switch (sortBy) {
        case FILTER_OPTIONS.SORT.RATING:
          return (bRating.rating || DEFAULT_RATING) - (aRating.rating || DEFAULT_RATING);
        case FILTER_OPTIONS.SORT.WORST_RATING:
          return (aRating.rating || DEFAULT_RATING) - (bRating.rating || DEFAULT_RATING);
        case FILTER_OPTIONS.SORT.NAME:
          return a.name.localeCompare(b.name);
        case FILTER_OPTIONS.SORT.LAST_UPDATED:
          return new Date(bRating.updated_at || 0) - new Date(aRating.updated_at || 0);
        case FILTER_OPTIONS.SORT.MATCHES:
          return ((bRating.wins || 0) + (bRating.losses || 0)) - 
                 ((aRating.wins || 0) + (aRating.losses || 0));
        default:
          return 0;
      }
    });
  }, [nameOptions, sortBy]);

  const filteredRatings = useMemo(() => {
    return sortedRatings.map(name => {
      const rating = name.cat_name_ratings?.[0] || {};
      return {
        id: name.id,
        name: name.name,
        description: name.description,
        rating: parseInt(rating.rating || DEFAULT_RATING, 10),
        wins: parseInt(rating.wins || 0, 10),
        losses: parseInt(rating.losses || 0, 10),
        updated_at: rating.updated_at || name.created_at,
        isHidden: name.isHidden
      };
    });
  }, [sortedRatings]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className={styles.error}>Error: {error}</div>;

  return (
    <div className={styles.profileContainer}>
      <header className={styles.profileHeader}>
        <h1>{currentlyViewedUser}'s Cat Name Rankings</h1>
        <div className={styles.headerActions}>
          {isAdmin && (
            <Button 
              onClick={() => setShowAggregated(!showAggregated)}
              variant="default"
            >
              {showAggregated ? 'Show Individual View' : 'Show Overall Rankings'}
            </Button>
          )}
          {userName.toLowerCase() === 'aaron' && (
            <Button onClick={onStartNewTournament}>Start Tournament</Button>
          )}
        </div>
      </header>

      {isAdmin && !showAggregated && (
        <AdminPanel
          users={users}
          onRefresh={handleUserAction}
        />
      )}

      <div className={styles.mainContent}>
        {showAggregated ? (
          <AggregatedStats nameOptions={nameOptions} />
        ) : (
          <>
            <FilterControls 
              onFilterChange={setFilterStatus}
              onSortChange={setSortBy}
              currentFilter={filterStatus}
              currentSort={sortBy}
            />

            <ProfileStats ratings={currentlyViewedUser !== userName ? currentUserRatings : ratingsData} filterStatus={filterStatus} />

            <div className={styles.chartContainer}>
              <Bar 
                data={prepareChartData(nameOptions, filterStatus)}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      display: false
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const rating = context.raw;
                          const name = context.label;
                          const isHidden = nameOptions.find(n => n.name === name)?.isHidden;
                          return `${name}: ${rating} ${isHidden ? '(Hidden)' : ''}`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: false,
                      min: Math.min(...ratingsData.map(r => r.rating)) - 100,
                      title: {
                        display: true,
                        text: 'Rating'
                      }
                    }
                  }
                }}
              />
            </div>

            <div className={styles.namesGrid}>
              {filteredRatings.map(name => (
                <NameCard
                  key={name.id}
                  name={{
                    ...name,
                    name: name.name,
                    averageRating: name.rating,
                    totalVotes: 1,
                    userCount: 1
                  }}
                  isHidden={name.isHidden}
                  onToggleVisibility={handleToggleNameVisibility}
                  onDelete={handleDeleteName}
                  isAdmin={isAdmin}
                  isAggregated={false}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showDeleteNameConfirm && (
        <ConfirmDialog
          title="Delete Name"
          message={`Are you sure you want to delete "${nameToDelete?.name}"?`}
          onConfirm={() => handleDeleteName(nameToDelete.id)}
          onCancel={() => {
            setShowDeleteNameConfirm(false);
            setNameToDelete(null);
          }}
          isLoading={deleteNameStatus.loading}
          error={deleteNameStatus.error}
        />
      )}
    </div>
  );
};

export default Profile;